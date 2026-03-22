// ─── JWT token utilities ──────────────────────────────────────────────────────
// We use two tokens:
//   Access token  — short-lived (15m), sent on every API request
//   Refresh token — long-lived (7d), used only to get a new access token
// This dual-token strategy means stolen access tokens expire quickly.

const jwt = require('jsonwebtoken');

// Fail loudly at startup if the secrets are missing — running without them is a security hole
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables. ' +
    'Generate strong secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';           // access token lifetime
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'; // refresh token lifetime

// generateTokens — creates both tokens from the user record.
// Payload embeds userId, loginId, and role so we can skip a DB call on most requests.
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    loginId: user.loginId,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });

  return { accessToken, refreshToken };
};

// verifyAccessToken — throws if the token is expired or tampered with
const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// verifyRefreshToken — same but uses the separate refresh secret
const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};
