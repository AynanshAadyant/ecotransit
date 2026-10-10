import { Router } from 'express';
import type { StopController } from '../controllers/stop.controller.js';

export function createStopRouter(controller: StopController): Router {
  const router = Router();
  router.get('/stops/nearby', controller.getNearby);
  router.get('/stops/search', controller.search);
  router.get('/stops/:stopId', controller.getById);
  router.get('/stops/:stopId/routes', controller.getRoutes);
  return router;
}
