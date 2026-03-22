// ─── Entry point for the Express server ───────────────────────────────────────
// This file wires together all middleware, routes, error handlers, and starts
// the HTTP server with Socket.io attached.

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config(); // Load .env variables (DATABASE_URL, JWT_SECRET, PORT, etc.)

const { apiLimiter } = require('./middleware/rate-limit.middleware');
const { ensureDefaultEcoWorkflow } = require('./services/stage-bootstrap.service');
const { init: initSocket } = require('./socket');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow requests only from our React frontend (default: http://localhost:5173).
// credentials: true is needed because we send Authorization headers.
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Security headers (helmet) ────────────────────────────────────────────────
// Sets various HTTP headers to protect against common web vulnerabilities.
// crossOriginResourcePolicy 'cross-origin' lets the frontend load uploaded files.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── Request logging ──────────────────────────────────────────────────────────
// Morgan logs every incoming request to the console in dev format.
app.use(morgan('dev'));

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Parse JSON and URL-encoded bodies. Capped at 1MB to prevent DoS via huge payloads.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Static file serving ──────────────────────────────────────────────────────
// Uploaded files (PDFs, images, etc.) are served from /uploads on disk.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Health check ─────────────────────────────────────────────────────────────
// Used by monitoring tools and Docker health checks to confirm the server is alive.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// Each route module handles one feature area. apiLimiter is applied to all
// data-heavy routes to throttle abuse.
app.use('/api/auth', require('./routes/auth.routes'));                         // login, signup, token refresh
app.use('/api/products', apiLimiter, require('./routes/product.routes'));      // product CRUD + versioning
app.use('/api/boms', apiLimiter, require('./routes/bom.routes'));              // bill of materials CRUD
app.use('/api/ecos', apiLimiter, require('./routes/eco.routes'));              // ECO lifecycle management
app.use('/api/settings', apiLimiter, require('./routes/settings.routes'));     // ECO stages + approval rules
app.use('/api/reports', apiLimiter, require('./routes/report.routes'));        // reporting endpoints
app.use('/api/upload', require('./routes/upload.routes'));                     // file uploads (no rate limiter — has its own)
app.use('/api/audit-logs', apiLimiter, require('./routes/audit.routes'));      // audit trail
app.use('/api/admin', apiLimiter, require('./routes/admin.routes'));           // admin user management

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches any error thrown in a controller and returns a clean JSON response.
// Prisma-specific error codes are translated into meaningful HTTP responses.
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // P2002 = unique constraint violation (e.g. duplicate email)
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A record with this value already exists',
      });
    }
    // P2025 = record not found (e.g. update on non-existent row)
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
      });
    }
  }

  // For all other errors use the statusCode set on the error object, or default to 500
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
// Any request that didn't match a route above gets this response.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

const PORT = process.env.PORT || 5000;

// ─── Server startup ───────────────────────────────────────────────────────────
// 1. Bootstrap default ECO stages in the DB if they don't exist yet.
// 2. Attach Socket.io to the HTTP server for real-time updates.
// 3. Start listening on PORT.
const startServer = async () => {
  try {
    await ensureDefaultEcoWorkflow(); // seed ECO stages (New → In Progress → Approval → Done)
    const server = http.createServer(app);
    initSocket(server);               // attach Socket.io
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
