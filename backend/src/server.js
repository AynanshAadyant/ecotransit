require('dotenv').config();
const http = require('http');
const app = require('./app');
const db = require('./config/db');
const redis = require('./config/redis');
const { initWebSocket } = require('./websocket');
const { initMqtt } = require('./mqtt');

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async () => {
  try {
    console.log('='.repeat(60));
    console.log('  ECO-TRANSIT ADMIN + STAFF BACKEND STARTING');
    console.log('='.repeat(60));

    // 1. Initialize Database
    await db.connectDb();

    // 2. Initialize Redis (Real-Time Cache)
    await redis.initRedis();

    // 3. Create HTTP Server
    const server = http.createServer(app);

    // 4. Initialize WebSocket Server
    initWebSocket(server);

    // 5. Initialize MQTT Ingestion
    await initMqtt();

    // 6. Start Listening
    server.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log(`  Eco-Transit Backend running on http://localhost:${PORT}`);
      console.log(`  API Base URL: http://localhost:${PORT}/api`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(60));
    });

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n[Shutdown] Received ${signal}. Closing server gracefully...`);
      server.close(() => {
        console.log('[Shutdown] HTTP server closed.');
        process.exit(0);
      });

      // Force exit if hanging
      setTimeout(() => {
        console.error('[Shutdown] Force exit after timeout.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start Eco-Transit server:', error);
    process.exit(1);
  }
};

startServer();
