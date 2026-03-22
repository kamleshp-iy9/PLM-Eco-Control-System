// ─── Authentication middleware ────────────────────────────────────────────────
// Runs before any protected route handler.
// Reads the Bearer token from the Authorization header, verifies it,
// then fetches the user from the DB and attaches them to req.user.
// If anything is wrong the request is rejected with 401.

const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../utils/errors');
const { PrismaClient, AccountStatus } = require('@prisma/client');

const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Expect header format: "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    // Strip the "Bearer " prefix (7 characters) to get the raw token string
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token); // throws if expired or tampered

    // We re-fetch the user on every request to catch suspended/deleted accounts
    // even before their token expires. Small overhead, big security gain.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Prevent suspended or pending users from making API calls
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedError('User account is not active');
    }

    // Attach the full user object so controllers don't need to fetch it again
    req.user = user;
    next();
  } catch (error) {
    // Convert JWT library errors into our standard UnauthorizedError format
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Invalid or expired token'));
    } else {
      next(error);
    }
  }
};

module.exports = {
  authenticate,
};
