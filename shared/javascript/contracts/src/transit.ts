import type { VehiclePosition } from './ingestion.js';
import type { TimeBucket } from './common.js';

export interface Stop {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  clusterId?: string | undefined;
}

export interface RouteSummary {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType?: number | undefined;
}

export interface RouteSegment {
  segmentId: number;
  routeId: string;
  fromStopId: string;
  toStopId: string;
  sequence: number;
  distanceMeters: number;
}

export interface NearestStopResult {
  stopId: string;
  stopSequence: number;
  distanceMeters: number;
}

export interface LivePosition extends VehiclePosition {
  updatedAt: number;
}

export interface EtaResult {
  etaSeconds: number;
  varianceTotal: number;
  weakestCellSupport: number;
}

export interface SegmentHeat {
  segmentId: number;
  averageSpeedKmh: number;
  congestionScore: number;
}

export interface RemainingSegmentsRequest {
  vehicleId: string;
  routeId: string;
  fromSequence: number;
  targetStopId: string;
}

export interface GetVehicleEtaQuery {
  vehicleId: string;
  targetStopId: string;
}

export interface ILivePositionRepository {
  find(vehicleId: string): Promise<LivePosition | null>;
  findAllLive(): Promise<LivePosition[]>;
  findByRoute(routeIds: string[]): Promise<LivePosition[]>;
}

export interface ITraversalMatrixRepository {
  sumTraversal(segmentIds: number[], bucket: TimeBucket): Promise<EtaResult>;
  fetchHeatmapForRoute(routeId: string, bucket: TimeBucket): Promise<SegmentHeat[]>;
}

export interface IRouteSegmentRepository {
  findRemaining(
    routeId: string,
    fromSequence: number,
    targetStopId: string,
  ): Promise<RouteSegment[]>;
  findRemainingForMany(
    requests: RemainingSegmentsRequest[],
  ): Promise<Map<string, RouteSegment[]>>;
}

export interface IStopRepository {
  findNearby(lat: number, lon: number, radiusM: number): Promise<Stop[]>;
  findNearestOnRoute(routeId: string, lat: number, lon: number): Promise<NearestStopResult>;
  findRoutesServingStop(stopId: string): Promise<RouteSummary[]>;
}
