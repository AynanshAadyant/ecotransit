import { NotFoundError } from '@ecotransit/core-utils';
import type { ILivePositionRepository, LivePosition } from '../repositories/contracts.js';

export class VehicleService {
  constructor(private readonly livePosRepo: ILivePositionRepository) {}

  async getAllLiveVehicles(): Promise<LivePosition[]> {
    return this.livePosRepo.findAllLive();
  }

  async getLiveVehicleById(vehicleId: string): Promise<LivePosition> {
    const vehicle = await this.livePosRepo.find(vehicleId);
    if (!vehicle) {
      throw new NotFoundError('Live vehicle', vehicleId);
    }
    return vehicle;
  }

  async getLiveVehiclesByRoute(routeId: string): Promise<LivePosition[]> {
    return this.livePosRepo.findByRoute([routeId]);
  }
}
