import type { TimeBucket } from '@ecotransit/contracts';
import type {
  ILivePositionRepository,
  IStopRepository,
  IRouteRepository,
  IRouteSegmentRepository,
  ITraversalMatrixRepository,
  LivePosition,
  Stop,
  RouteSummary,
  RouteSegment,
  NearestStopResult,
  EtaResult,
  SegmentHeat,
  RemainingSegmentsRequest,
  DirectJourneyResult,
} from '../../src/repositories/contracts.js';
import type { ISocketGateway, TelemetryBatchFrame } from '@ecotransit/contracts';

export class MockLivePositionRepository implements ILivePositionRepository {
  public positions = new Map<string, LivePosition>();
  public shouldFail = false;

  async find(vehicleId: string): Promise<LivePosition | null> {
    if (this.shouldFail) throw new Error('Simulated Redis connection failure');
    return this.positions.get(vehicleId) ?? null;
  }

  async findAllLive(): Promise<LivePosition[]> {
    if (this.shouldFail) throw new Error('Simulated Redis connection failure');
    return Array.from(this.positions.values());
  }

  async findByRoute(routeIds: string[]): Promise<LivePosition[]> {
    if (this.shouldFail) throw new Error('Simulated Redis connection failure');
    const set = new Set(routeIds);
    return Array.from(this.positions.values()).filter((p) => set.has(p.routeId));
  }
}

export class MockStopRepository implements IStopRepository {
  public stops = new Map<string, Stop>();
  public routeStopSequences = new Map<string, { stopId: string; sequence: number }[]>();
  public shouldFail = false;

  async findById(stopId: string): Promise<Stop | null> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return this.stops.get(stopId) ?? null;
  }

  async findNearby(lat: number, lon: number, radiusM: number): Promise<Stop[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const result: Stop[] = [];
    for (const stop of this.stops.values()) {
      const dist = calculateHaversine(lat, lon, stop.latitude, stop.longitude);
      if (dist <= radiusM) {
        result.push(stop);
      }
    }
    return result;
  }

  async findNearestOnRoute(
    routeId: string,
    lat: number,
    lon: number,
    bearing?: number,
  ): Promise<NearestStopResult> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const routeStops = this.routeStopSequences.get(routeId);
    if (!routeStops || routeStops.length === 0) {
      throw new Error(`No stops found on route '${routeId}'`);
    }

    let nearest = routeStops[0]!;
    let minDist = Infinity;

    for (const rs of routeStops) {
      const stop = this.stops.get(rs.stopId);
      if (!stop) continue;
      const dist = calculateHaversine(lat, lon, stop.latitude, stop.longitude);
      if (dist < minDist) {
        minDist = dist;
        nearest = rs;
      }
    }

    if (bearing !== undefined && routeStops.length > 1) {
      const stopEntity = this.stops.get(nearest.stopId);
      if (stopEntity) {
        const rad = (bearing * Math.PI) / 180;
        const vLon = Math.sin(rad);
        const vLat = Math.cos(rad);
        const uLat = stopEntity.latitude - lat;
        const uLon = stopEntity.longitude - lon;
        const dot = uLon * vLon + uLat * vLat;

        if (dot < 0) {
          const next = routeStops.find((s) => s.sequence > nearest.sequence);
          if (next) {
            const nextStopEntity = this.stops.get(next.stopId);
            const nextDist = nextStopEntity
              ? calculateHaversine(lat, lon, nextStopEntity.latitude, nextStopEntity.longitude)
              : minDist;
            return {
              stopId: next.stopId,
              stopSequence: next.sequence,
              distanceMeters: Math.round(nextDist),
            };
          }
        }
      }
    }

    return {
      stopId: nearest.stopId,
      stopSequence: nearest.sequence,
      distanceMeters: Math.round(minDist),
    };
  }

  async findRoutesServingStop(stopId: string): Promise<RouteSummary[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const result: RouteSummary[] = [];
    for (const [routeId, stops] of this.routeStopSequences.entries()) {
      if (stops.some((s) => s.stopId === stopId)) {
        result.push({
          routeId,
          routeShortName: routeId,
          routeLongName: `Route ${routeId}`,
          routeType: 3,
        });
      }
    }
    return result;
  }

  async searchByName(queryStr: string, _limit = 20): Promise<Stop[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const q = queryStr.toLowerCase();
    return Array.from(this.stops.values()).filter((s) =>
      s.stopName.toLowerCase().includes(q),
    );
  }
}

export class MockRouteRepository implements IRouteRepository {
  public routes = new Map<string, RouteSummary>();
  public routeStops = new Map<string, Stop[]>();
  public directJourneys: DirectJourneyResult[] = [];
  public shouldFail = false;

  async findById(routeId: string): Promise<RouteSummary | null> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return this.routes.get(routeId) ?? null;
  }

  async findAll(): Promise<RouteSummary[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return Array.from(this.routes.values());
  }

  async findStopsByRoute(routeId: string): Promise<Stop[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return this.routeStops.get(routeId) ?? [];
  }

  async findDirectJourneys(
    originStopId: string,
    destinationStopId: string,
  ): Promise<DirectJourneyResult[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return this.directJourneys.filter(
      (j) => j.originStop.stopId === originStopId && j.destinationStop.stopId === destinationStopId,
    );
  }
}

export class MockRouteSegmentRepository implements IRouteSegmentRepository {
  public segments = new Map<string, RouteSegment[]>(); // key: routeId
  public shouldFail = false;

  async findRemaining(
    routeId: string,
    fromSequence: number,
    targetStopId: string,
  ): Promise<RouteSegment[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const routeSegs = this.segments.get(routeId) || [];

    // Find segment sequence leading to target stop
    const targetSeg = routeSegs.find((s) => s.toStopId === targetStopId);
    if (!targetSeg) return [];

    const targetSequence = targetSeg.sequence;
    if (targetSequence < fromSequence) return [];

    return routeSegs.filter((s) => s.sequence >= fromSequence && s.sequence <= targetSequence);
  }

  async findRemainingForMany(
    requests: RemainingSegmentsRequest[],
  ): Promise<Map<string, RouteSegment[]>> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    const map = new Map<string, RouteSegment[]>();
    for (const req of requests) {
      const remaining = await this.findRemaining(req.routeId, req.fromSequence, req.targetStopId);
      map.set(req.vehicleId, remaining);
    }
    return map;
  }
}

export class MockTraversalMatrixRepository implements ITraversalMatrixRepository {
  public shouldFail = false;
  public defaultEtaSeconds = 300;

  async sumTraversal(segmentIds: number[], _bucket: TimeBucket): Promise<EtaResult> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    if (!segmentIds || segmentIds.length === 0) {
      return { etaSeconds: 0, varianceTotal: 0, weakestCellSupport: 0 };
    }
    return {
      etaSeconds: segmentIds.length * 60,
      varianceTotal: 1.5,
      weakestCellSupport: 45,
    };
  }

  async fetchHeatmapForRoute(_routeId: string, _bucket: TimeBucket): Promise<SegmentHeat[]> {
    if (this.shouldFail) throw new Error('Simulated Database query error');
    return [];
  }
}

export class MockSocketGateway implements ISocketGateway {
  public broadcastedFrames: TelemetryBatchFrame[] = [];
  public clientCount = 1;

  broadcast(frame: TelemetryBatchFrame): void {
    this.broadcastedFrames.push(frame);
  }

  connectionCount(): number {
    return this.clientCount;
  }
}

function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
