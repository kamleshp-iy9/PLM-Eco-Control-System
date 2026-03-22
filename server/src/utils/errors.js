// ─── Custom error classes ─────────────────────────────────────────────────────
// All application errors extend AppError so the global error handler can
// send the right HTTP status code without any extra logic in controllers.
// Just throw one of these and Express will handle the rest.

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    // "fail" for 4xx client errors, "error" for 5xx server errors
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // isOperational marks expected errors so we don't log a full stack trace for them
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 — the request body failed validation (missing field, wrong format, etc.)
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

// 401 — no token, expired token, or wrong credentials
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

// 403 — authenticated but not allowed (e.g. non-admin hitting an admin route)
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

// 404 — the requested record does not exist in the database
class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

// 409 — conflict, e.g. trying to create a duplicate unique record
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
