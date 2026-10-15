const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io = null;

/**
 * Initialize Socket.IO server with HTTP server instance
 * @param {import('http').Server} server 
 */
const initWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true
    }
  });

  // Optional handshake authentication for clients
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = verifyToken(token);
        socket.user = decoded;
      } catch (err) { // eslint-disable-line no-unused-vars
        // Token provided but invalid; we allow connection but don't set user
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const userRole = socket.user?.role?.toUpperCase();
    console.log(`[WebSocket] Client connected: ${socket.id}${userRole ? ` (Role: ${userRole})` : ''}`);

    if (userRole === 'ADMIN') {
      socket.join('admin-room');
    } else if (userRole === 'STAFF') {
      socket.join('staff-room');
    }

    socket.on('subscribe:vehicle', (vehicleId) => {
      socket.join(`vehicle:${vehicleId}`);
    });

    socket.on('unsubscribe:vehicle', (vehicleId) => {
      socket.leave(`vehicle:${vehicleId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[WebSocket] Socket.IO initialized and ready.');
  return io;
};

/**
 * Broadcast an event to all connected dashboards
 */
const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

/**
 * Broadcast to a specific room or topic
 */
const broadcastTo = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

/**
 * Specific Event Dispatchers
 */
const emitVehicleLocation = (payload) => {
  broadcast('vehicle:location_updated', payload);
  if (payload.vehicleId) {
    broadcastTo(`vehicle:${payload.vehicleId}`, 'vehicle:location_updated', payload);
  }
};

const emitVehicleStatus = (vehicleId, status, details = {}) => {
  const payload = { vehicleId, status, ...details, timestamp: new Date().toISOString() };
  broadcast('vehicle:status_changed', payload);
  if (status === 'offline') {
    broadcast('vehicle:offline', payload);
  }
};

const emitTripStarted = (trip) => {
  broadcast('trip:started', trip);
};

const emitTripCompleted = (trip) => {
  broadcast('trip:completed', trip);
};

const emitIncidentCreated = (incident) => {
  broadcast('incident:created', incident);
};

const emitIncidentUpdated = (incident) => {
  broadcast('incident:updated', incident);
};

module.exports = {
  initWebSocket,
  getIO: () => io,
  broadcast,
  broadcastTo,
  emitVehicleLocation,
  emitVehicleStatus,
  emitTripStarted,
  emitTripCompleted,
  emitIncidentCreated,
  emitIncidentUpdated
};
