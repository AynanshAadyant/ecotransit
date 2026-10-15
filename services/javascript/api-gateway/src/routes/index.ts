import { Router } from 'express';
import type {
  HealthController,
  StopController,
  RouteController,
  VehicleController,
  EtaController,
} from '../controllers/index.js';
import { createHealthRouter } from './health.routes.js';
import { createStopRouter } from './stop.routes.js';
import { createRouteRouter } from './route.routes.js';
import { createVehicleRouter } from './vehicle.routes.js';
import { createEtaRouter } from './eta.routes.js';

export interface ControllerSet {
  healthController: HealthController;
  stopController: StopController;
  routeController: RouteController;
  vehicleController: VehicleController;
  etaController: EtaController;
}

export function createApiRouter(controllers: ControllerSet): Router {
  const router = Router();

  router.use('/', createHealthRouter(controllers.healthController));
  router.use('/', createStopRouter(controllers.stopController));
  router.use('/', createRouteRouter(controllers.routeController, controllers.vehicleController));
  router.use('/', createVehicleRouter(controllers.vehicleController));
  router.use('/', createEtaRouter(controllers.etaController));

  return router;
}

export * from './health.routes.js';
export * from './stop.routes.js';
export * from './route.routes.js';
export * from './vehicle.routes.js';
export * from './eta.routes.js';
