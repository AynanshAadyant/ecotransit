import { BaseController } from '@ecotransit/core-utils';
import { GetVehicleEtaSchema } from '../dto/index.js';
import type { IEtaService } from '../services/contracts.js';

export class EtaController extends BaseController {
  constructor(private readonly etaService: IEtaService) {
    super();
  }

  getEtaForVehicle = this.handle(async (req) => {
    const query = GetVehicleEtaSchema.parse({
      vehicleId: req.params['vehicleId'],
      targetStopId: req.query['stopId'],
    });
    return this.etaService.getEtaForVehicle(query);
  });
}
