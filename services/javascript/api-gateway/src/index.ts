import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '@ecotransit/core-utils';
import { createPool, createRedisClient } from '@ecotransit/data-access';
import { loadGatewayConfig } from './config.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';

function loadEnv(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(currentDir, '../../../../.env'),
    path.resolve(currentDir, '../../../.env'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      if (typeof process.loadEnvFile === 'function') {
        try {
          process.loadEnvFile(candidate);
          break;
        } catch {}
      }
    }
  }
}

const logger = createLogger('api-gateway');

async function bootstrap() {
  loadEnv();
  const config = loadGatewayConfig();

  const pool = createPool({ max: 10 });
  const redisClient = createRedisClient();
  await redisClient.connect();

  const server = http.createServer();

  // Rewrite /events/telemetry requests to /socket.io for unified Socket.IO handling
  server.prependListener('request', (req) => {
    if (req.url && req.url.startsWith('/events/telemetry')) {
      req.url = req.url.replace('/events/telemetry', '/socket.io');
    }
  });
  server.prependListener('upgrade', (req) => {
    if (req.url && req.url.startsWith('/events/telemetry')) {
      req.url = req.url.replace('/events/telemetry', '/socket.io');
    }
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const container = createContainer(config, pool, redisClient, io);
  const app = createApp(container);

  server.on('request', (req, res) => {
    if (req.url && (req.url.startsWith('/socket.io') || req.url.startsWith('/events/telemetry'))) {
      return;
    }
    app(req, res);
  });

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
