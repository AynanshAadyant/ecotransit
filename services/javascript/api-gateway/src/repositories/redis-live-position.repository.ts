import type { RedisClientType } from 'redis';
import { vehicleLiveKey, vehicleGeoKey, routeLiveKey } from '@ecotransit/data-access';
import type { ILivePositionRepository, LivePosition } from './contracts.js';

export class RedisLivePositionRepository implements ILivePositionRepository {
  constructor(private readonly redisClient: RedisClientType) {}

  async find(vehicleId: string): Promise<LivePosition | null> {
    const key = vehicleLiveKey(vehicleId);
    const data = await this.redisClient.hGetAll(key);
    if (!data || Object.keys(data).length === 0 || !data['vehicle_id']) {
      return null;
    }
    return this.mapHashToPosition(data);
  }

  async findAllLive(): Promise<LivePosition[]> {
    const geoKey = vehicleGeoKey();
    const vehicleIds = await this.redisClient.zRange(geoKey, 0, -1);
    if (!vehicleIds || vehicleIds.length === 0) {
      return [];
    }

    const pipeline = this.redisClient.multi();
    for (const vehicleId of vehicleIds) {
      pipeline.hGetAll(vehicleLiveKey(vehicleId));
    }

    const results = (await pipeline.exec()) as unknown as (Record<string, string> | null)[];
    const positions: LivePosition[] = [];
    const staleVehicleIds: string[] = [];

    for (let i = 0; i < vehicleIds.length; i++) {
      const data = results[i];
      const vid = vehicleIds[i];
      if (data && typeof data === 'object' && Object.keys(data).length > 0 && data['vehicle_id']) {
        positions.push(this.mapHashToPosition(data));
      } else if (vid) {
        staleVehicleIds.push(vid);
      }
    }

    if (staleVehicleIds.length > 0) {
      // Opportunistically prune expired vehicles from the geospatial index to prevent memory leak
      this.redisClient.zRem(geoKey, staleVehicleIds).catch(() => {});
    }

    return positions;
  }

  async findByRoute(routeIds: string[]): Promise<LivePosition[]> {
    if (!routeIds || routeIds.length === 0) {
      return [];
    }

    const vehicleIdSet = new Set<string>();
    for (const routeId of routeIds) {
      const ids = await this.redisClient.sMembers(routeLiveKey(routeId));
      for (const id of ids) {
        vehicleIdSet.add(id);
      }
    }

    if (vehicleIdSet.size === 0) {
      return [];
    }

    const pipeline = this.redisClient.multi();
    for (const vehicleId of vehicleIdSet) {
      pipeline.hGetAll(vehicleLiveKey(vehicleId));
    }

    const results = (await pipeline.exec()) as unknown as (Record<string, string> | null)[];
    const positions: LivePosition[] = [];

    for (const data of results) {
      if (data && typeof data === 'object' && Object.keys(data).length > 0 && data['vehicle_id']) {
        positions.push(this.mapHashToPosition(data));
      }
    }

    return positions;
  }

  private mapHashToPosition(data: Record<string, string>): LivePosition {
    const timestamp = parseInt(data['timestamp'] || '0', 10);
    return {
      vehicleId: data['vehicle_id']!,
      routeId: data['route_id'] || '',
      tripId: data['trip_id'],
      latitude: parseFloat(data['latitude'] || '0'),
      longitude: parseFloat(data['longitude'] || '0'),
      speed: data['speed'] !== undefined ? parseFloat(data['speed']) : undefined,
      bearing: data['bearing'] !== undefined ? parseFloat(data['bearing']) : undefined,
      isSpeedSuspect: data['is_speed_suspect'] === '1',
      timestamp,
      updatedAt: timestamp,
    };
  }
}
