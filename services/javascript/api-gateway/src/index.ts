import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '@ecotransit/core-utils';
import { createPool, createRedisClient } from '@ecotransit/data-access';
import { loadGatewayConfig } from './config.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';

const logger = createLogger('api-gateway');

async function bootstrap() {
  const config = loadGatewayConfig();

  const pool = createPool({ max: 10 });
  const redisClient = createRedisClient();
  await redisClient.connect();

  const server = http.createServer();
  const io = new SocketIOServer(server, {
    cors: { origin: config.CORS_ORIGIN },
  });

  const container = createContainer(config, pool, redisClient, io);
  const app = createApp(container);

  server.on('request', app);

  container.broadcastScheduler.start();

  const port = config.PORT_API_GATEWAY;

  if (process.env['NODE_ENV'] !== 'test') {
    server.listen(port, () => {
      logger.info({ port }, `API Gateway running on port ${port}`);
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, `Received ${signal}, initiating graceful shutdown`);
      container.broadcastScheduler.stop();
      io.close();
      server.close();
      await redisClient.quit();
      await pool.end();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  return { app, server, io, container };
}

export { bootstrap };

if (process.env['NODE_ENV'] !== 'test') {
  bootstrap().catch((err) => {
    logger.error({ err }, 'Failed to start API Gateway');
    process.exit(1);
  });
}
