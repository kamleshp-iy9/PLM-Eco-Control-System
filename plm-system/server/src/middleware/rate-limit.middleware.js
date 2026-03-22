// ─── Rate limiting middleware ──────────────────────────────────────────────────
// Limits how many requests a single IP can make in a given time window.
// In development the limits are much higher so they don't get in the way.
// In production they're tightened to protect against brute-force and abuse.

const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV !== 'production';

// createLimiter — thin wrapper around express-rate-limit with standard headers enabled.
// Returns RateLimit-* headers so clients can see how many requests they have left.
const createLimiter = (options) =>
  rateLimit({
    standardHeaders: true,  // return rate limit info in the RateLimit-* headers
    legacyHeaders: false,   // disable the old X-RateLimit-* headers
    ...options,
  });

// ─── General API limiter ───────────────────────────────────────────────────────
// Applied to all data routes: products, BOMs, ECOs, reports, settings, etc.
// 500 requests per 15 minutes per IP in production.
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  max: isDevelopment ? 2000 : 500,
  message: {
    success: false,
    error: 'Too many API requests, please try again later',
  },
});

// ─── Auth attempt limiter ──────────────────────────────────────────────────────
// Applied to login and signup. skipSuccessfulRequests means only failed
// attempts count toward the limit, so legitimate users aren't penalised.
// Tight in production (10 attempts per 15 min) to block password brute-force.
const authAttemptLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 50 : 10,
  skipSuccessfulRequests: true, // don't penalise successful logins
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
});

// ─── Token refresh limiter ─────────────────────────────────────────────────────
// Applied to /auth/refresh. Prevents refresh token hammering.
// Shorter window (5 min) because token refresh should be infrequent.
const refreshLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: isDevelopment ? 120 : 30,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many token refresh attempts, please try again later',
  },
});

// ─── Upload limiter ────────────────────────────────────────────────────────────
// Applied to file upload endpoints. Lower limit because uploads are expensive.
const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 100 : 25,
  message: {
    success: false,
    error: 'Too many upload requests, please try again later',
  },
});

module.exports = {
  apiLimiter,
  authAttemptLimiter,
  refreshLimiter,
  uploadLimiter,
};
