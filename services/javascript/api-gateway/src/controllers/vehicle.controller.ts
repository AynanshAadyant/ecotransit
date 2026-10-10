import { BaseController } from '@ecotransit/core-utils';
import { VehicleIdParamSchema, RouteIdParamSchema } from '../dto/index.js';
import type { VehicleService } from '../services/vehicle.service.js';

export class VehicleController extends BaseController {
  constructor(private readonly vehicleService: VehicleService) {
    super();
  }

  getAllLive = this.handle(async () => {
    return this.vehicleService.getAllLiveVehicles();
  });

  getById = this.handle(async (req) => {
    const params = VehicleIdParamSchema.parse(req.params);
    return this.vehicleService.getLiveVehicleById(params.vehicleId);
  });

  getByRoute = this.handle(async (req) => {
    const params = RouteIdParamSchema.parse(req.params);
    return this.vehicleService.getLiveVehiclesByRoute(params.routeId);
  });
}
