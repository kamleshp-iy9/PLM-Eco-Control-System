// ─── Role-based access control middleware ─────────────────────────────────────
// After authenticate() attaches req.user, these middlewares gate routes by role.
// Usage example:  router.post('/products', authenticate, requireEngineering, handler)

const { ForbiddenError } = require('../utils/errors');

// requireRole — factory that returns a middleware accepting only the listed roles.
// Pass one or more role strings: requireRole('ADMIN', 'APPROVER')
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Should not happen — authenticate() always runs first — but guard anyway
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    // If the logged-in user's role is not in the allowed list, block them
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

// Pre-built role guards used throughout the route files:

// Only the system ADMIN can manage users, configure stages, etc.
const requireAdmin = requireRole('ADMIN');

// Engineers and admins can create/edit products, BOMs, and ECOs
const requireEngineering = requireRole('ADMIN', 'ENGINEERING_USER');

// Approvers and admins can review and approve ECOs
const requireApprover = requireRole('ADMIN', 'APPROVER');

// All authenticated roles can read data (operations users get read-only access)
const requireOperations = requireRole('ADMIN', 'ENGINEERING_USER', 'APPROVER', 'OPERATIONS_USER');

module.exports = {
  requireRole,
  requireAdmin,
  requireEngineering,
  requireApprover,
  requireOperations,
};
