import { Router } from 'express';
import type { EtaController } from '../controllers/eta.controller.js';

export function createEtaRouter(controller: EtaController): Router {
  const router = Router();
  router.get('/eta/:vehicleId', controller.getEtaForVehicle);
  return router;
}
