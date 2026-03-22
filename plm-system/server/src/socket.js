// ─── Socket.io server setup ───────────────────────────────────────────────────
// We use Socket.io to push real-time ECO updates to connected browser clients.
// Other parts of the app call getIO().emit(...) to broadcast events.

const { Server } = require('socket.io');

// io is kept in module scope so getIO() can return the same instance anywhere
let io;

// init — called once at server startup with the raw HTTP server
const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      // Only accept WebSocket connections from our frontend
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket client connected:', socket.id);

    // Clean up when the browser tab closes or the connection drops
    socket.on('disconnect', () => {
      console.log('Socket client disconnected:', socket.id);
    });
  });

  return io;
};

// getIO — returns the shared Socket.io instance so controllers can emit events
const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { init, getIO };
