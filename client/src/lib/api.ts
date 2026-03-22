// ─── Axios API client ─────────────────────────────────────────────────────────
// Central HTTP client for all frontend API calls. Key features:
//
//   1. Short-lived GET cache (5 s) — prevents duplicate fetches when the same
//      data is requested by multiple components mounting at the same time.
//   2. In-flight deduplication — if two GET requests for the same URL fire
//      simultaneously, only one HTTP request is made; both callers get the result.
//   3. Proactive token refresh — if the access token expires within 15 s of the
//      next request, we refresh it before sending rather than waiting for a 401.
//   4. Reactive 401 recovery — if a 401 slips through (e.g. clock skew), we
//      transparently refresh and retry the original request once.

import axios from 'axios';

// All requests go to /api on the same origin — Vite proxies this to localhost:5000
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token refresh singleton ───────────────────────────────────────────────────
// Keeps a reference to any in-progress refresh call so multiple expired-token
// errors trigger only ONE refresh request instead of a flood.
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

// ─── GET cache ─────────────────────────────────────────────────────────────────
const GET_CACHE_TTL_MS = 5000; // cache GET responses for 5 seconds
const getResponseCache = new Map<string, { expiresAt: number; response: any }>();
const getInFlightRequests = new Map<string, Promise<any>>(); // dedupe concurrent GETs

// ─── Auth helpers ──────────────────────────────────────────────────────────────

// Remove all auth state from localStorage and force a redirect to /login
const clearAuthSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('auth-storage');
};

// Bust the GET cache on any mutating request (POST/PUT/PATCH/DELETE) so
// the next GET fetches fresh data instead of a stale cached response
const clearGetRequestCache = () => {
  getResponseCache.clear();
  getInFlightRequests.clear();
};

// ─── Cache key helpers ─────────────────────────────────────────────────────────

// normalizeValue — recursively sorts object keys so {b:1, a:2} and {a:2, b:1}
// produce the same cache key. Without this, query param order could cause cache misses.
const normalizeValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeValue(value[key]);
        return result;
      }, {} as Record<string, any>);
  }

  return value;
};

// cloneData — deep clone a response body so the cached copy can't be mutated
// by whoever receives it. Uses structuredClone when available (modern browsers).
const cloneData = (data: any) => {
  if (data == null) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
};

// cloneResponse — returns a shallow copy of an Axios response with cloned data.
// configOverride lets us replace the config object (url, params, etc.) when
// serving a cached response so it looks like a fresh request to the caller.
const cloneResponse = (response: any, configOverride?: any) => ({
  ...response,
  data: cloneData(response.data),
  headers: { ...(response.headers || {}) },
  config: configOverride ? { ...(response.config || {}), ...configOverride } : response.config,
});

// isAuthRequest — skip caching and token injection for /auth/* endpoints
const isAuthRequest = (url?: string) => (url || '').includes('/auth/');

// ─── Token expiry utilities ────────────────────────────────────────────────────

// getTokenExpiryMs — decodes the JWT payload (no verification) to read the exp claim.
// Returns the expiry timestamp in milliseconds, or null if the token is malformed.
const getTokenExpiryMs = (token: string) => {
  try {
    const payload = token.split('.')[1]; // JWT structure: header.payload.signature
    if (!payload) return null;

    // Base64url → Base64 → JSON
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(padded));

    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null; // convert seconds → ms
  } catch {
    return null;
  }
};

// isTokenExpiring — returns true if the token expires within bufferMs.
// Default buffer is 15 s so we refresh before the server rejects the request.
const isTokenExpiring = (token: string, bufferMs = 15000) => {
  const expiry = getTokenExpiryMs(token);
  if (!expiry) return false;
  return expiry <= Date.now() + bufferMs;
};

// ─── Token refresh ─────────────────────────────────────────────────────────────
// Calls /auth/refresh with the stored refresh token and updates localStorage.
// Uses a module-level promise so concurrent calls share one HTTP request.
const refreshTokens = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('Refresh token missing');
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', { refreshToken })
      .then(({ data }) => {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        return {
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
        };
      })
      .finally(() => {
        refreshPromise = null; // clear so the next refresh starts fresh
      });
  }

  return refreshPromise;
};

// ─── Cache decision helpers ────────────────────────────────────────────────────

// shouldCacheGetRequest — only cache standard JSON GETs on non-auth routes.
// CSV downloads, binary responses, and explicitly skipped requests bypass the cache.
const shouldCacheGetRequest = (url: string, config: any = {}) => {
  if (!url || isAuthRequest(url)) return false;
  if ((config.responseType || 'json') !== 'json') return false;
  if (config.params?.format === 'csv') return false;
  if (config.headers?.['x-skip-cache']) return false; // opt-out header
  return true;
};

// buildGetRequestKey — stable cache key from URL + normalized params + responseType
const buildGetRequestKey = (url: string, config: any = {}) =>
  JSON.stringify({
    url,
    params: normalizeValue(config.params || {}),
    responseType: config.responseType || 'json',
  });

// ─── Patched api.get with caching ─────────────────────────────────────────────
// Wraps the original Axios get() to add:
//   • Cache hit → return cloned cached response immediately
//   • In-flight dedup → join existing promise instead of firing a second request
//   • Cache miss → fetch, cache the response, resolve both caller and future callers
const originalGet = api.get.bind(api);

api.get = ((url: string, config: any = {}) => {
  if (!shouldCacheGetRequest(url, config)) {
    return originalGet(url, config); // bypass cache for auth or non-JSON requests
  }

  const requestKey = buildGetRequestKey(url, config);
  const cachedResponse = getResponseCache.get(requestKey);

  // Return cached copy if it hasn't expired yet
  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    return Promise.resolve(cloneResponse(cachedResponse.response, { url, ...config }));
  }

  // Deduplicate: if an identical request is already in-flight, piggyback on it
  const inFlightRequest = getInFlightRequests.get(requestKey);
  if (inFlightRequest) {
    return inFlightRequest.then((response) => cloneResponse(response, { url, ...config }));
  }

  // No cache, no in-flight — fire the real request
  const requestPromise = originalGet(url, config)
    .then((response) => {
      // Store the response in the cache for GET_CACHE_TTL_MS milliseconds
      getResponseCache.set(requestKey, {
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        response: cloneResponse(response, { url, ...config }),
      });
      return response;
    })
    .finally(() => {
      getInFlightRequests.delete(requestKey); // allow fresh requests after this one finishes
    });

  getInFlightRequests.set(requestKey, requestPromise);
  return requestPromise.then((response) => cloneResponse(response, { url, ...config }));
}) as typeof api.get;

// ─── Request interceptor ───────────────────────────────────────────────────────
// Runs before every outgoing request:
//   1. Mutating requests clear the GET cache so stale data isn't served.
//   2. Attaches the Authorization: Bearer <token> header.
//   3. Proactively refreshes the token if it's about to expire.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';

  // Any write operation may have changed server state — bust the local cache
  if (method !== 'get' && !isAuthRequest(url)) {
    clearGetRequestCache();
  }

  const token = localStorage.getItem('accessToken');
  if (!token || isAuthRequest(url)) {
    return config; // no token yet or this is an auth request — skip injection
  }

  let accessToken = token;

  // Refresh proactively if the token expires within 15 s
  if (isTokenExpiring(token) && localStorage.getItem('refreshToken')) {
    try {
      const refreshedTokens = await refreshTokens();
      accessToken = refreshedTokens.accessToken;
    } catch {
      // Refresh failed (expired refresh token) — clear session and redirect to login
      clearAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return config;
    }
  }

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
// Handles 401 errors reactively (e.g. when clock skew causes a token to appear
// valid on the client but be rejected by the server).
// Strategy: attempt one token refresh and retry the original request.
// If the refresh also fails, clear the session and redirect to login.
api.interceptors.response.use(
  (response) => response, // pass through successful responses unchanged
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry && // prevent infinite retry loop
      !originalRequest?.url?.includes('/auth/refresh') // don't retry the refresh call itself
    ) {
      originalRequest._retry = true;

      try {
        // Edge case: another concurrent request may have already refreshed the token.
        // If the stored token is newer than the one we sent, just retry with it.
        const latestAccessToken = localStorage.getItem('accessToken');
        const originalAuthorization = originalRequest?.headers?.Authorization;

        if (latestAccessToken && originalAuthorization !== `Bearer ${latestAccessToken}`) {
          originalRequest.headers.Authorization = `Bearer ${latestAccessToken}`;
          return api(originalRequest);
        }

        // Our token is still the same stale one — refresh and retry
        const tokens = await refreshTokens();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — user must log in again
        clearAuthSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export { clearGetRequestCache };
export default api;
