import { Router } from 'express';
import type { VehicleController } from '../controllers/vehicle.controller.js';

export function createVehicleRouter(controller: VehicleController): Router {
  const router = Router();
  router.get('/vehicles/live', controller.getAllLive);
  router.get('/vehicles/live/:vehicleId', controller.getById);
  return router;
}
