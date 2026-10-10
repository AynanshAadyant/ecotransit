import { NotFoundError } from '@ecotransit/core-utils';
import type { IStopRepository, Stop, RouteSummary } from '../repositories/contracts.js';

export class StopService {
  constructor(private readonly stopRepo: IStopRepository) {}

  async getNearbyStops(lat: number, lon: number, radiusM: number): Promise<Stop[]> {
    return this.stopRepo.findNearby(lat, lon, radiusM);
  }

  async searchStops(query: string, limit = 20): Promise<Stop[]> {
    return this.stopRepo.searchByName(query, limit);
  }

  async getStopById(stopId: string): Promise<Stop> {
    const stop = await this.stopRepo.findById(stopId);
    if (!stop) {
      throw new NotFoundError('Stop', stopId);
    }
    return stop;
  }

  async getRoutesForStop(stopId: string): Promise<RouteSummary[]> {
    // Verify stop exists first
    await this.getStopById(stopId);
    return this.stopRepo.findRoutesServingStop(stopId);
  }
}
