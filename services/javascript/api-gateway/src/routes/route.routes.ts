import { Router } from 'express';
import type { RouteController } from '../controllers/route.controller.js';
import type { VehicleController } from '../controllers/vehicle.controller.js';

export function createRouteRouter(
  routeController: RouteController,
  vehicleController: VehicleController,
): Router {
  const router = Router();
  router.get('/routes', routeController.getAll);
  router.get('/routes/search', routeController.searchJourneys);
  router.get('/routes/search-coords', routeController.searchJourneysByCoords);
  router.get('/routes/:routeId', routeController.getById);
  router.get('/routes/:routeId/stops', routeController.getStops);
  router.get('/routes/:routeId/vehicles', vehicleController.getByRoute);
  return router;
}
