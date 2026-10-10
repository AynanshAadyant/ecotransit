import express, { type Express } from 'express';
import cors from 'cors';
import { errorMiddleware } from '@ecotransit/core-utils';
import type { ServiceContainer } from './container.js';
import { createApiRouter } from './routes/index.js';

export function createApp(container: ServiceContainer): Express {
  const app = express();

  app.use(cors({ origin: container.config.CORS_ORIGIN }));
  app.use(express.json());

  const apiRouter = createApiRouter({
    healthController: container.healthController,
    stopController: container.stopController,
    routeController: container.routeController,
    vehicleController: container.vehicleController,
    etaController: container.etaController,
  });

  app.use('/api', apiRouter);

  // Global centralized error handling middleware
  app.use(errorMiddleware);

  return app;
}
