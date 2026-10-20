import { NotFoundError, ValidationError } from '@ecotransit/core-utils';
import type {
  IRouteRepository,
  IStopRepository,
  RouteSummary,
  Stop,
  DirectJourneyResult,
} from '../repositories/contracts.js';

export class RouteService {
  constructor(
    private readonly routeRepo: IRouteRepository,
    private readonly stopRepo: IStopRepository,
  ) {}

  async getAllRoutes(): Promise<RouteSummary[]> {
    return this.routeRepo.findAll();
  }

  async getRouteById(routeId: string): Promise<RouteSummary> {
    const route = await this.routeRepo.findById(routeId);
    if (!route) {
      throw new NotFoundError('Route', routeId);
    }
    return route;
  }

  async getStopsForRoute(routeId: string): Promise<Stop[]> {
    // Verify route exists
    await this.getRouteById(routeId);
    return this.routeRepo.findStopsByRoute(routeId);
  }

  async findJourneys(
    originStopId: string,
    destinationStopId: string,
    radiusM = 800,
  ): Promise<DirectJourneyResult[]> {
    if (originStopId === destinationStopId) {
      throw new ValidationError('Origin and destination stops must be distinct');
    }

    const [originStop, destStop] = await Promise.all([
      this.stopRepo.findById(originStopId),
      this.stopRepo.findById(destinationStopId),
    ]);

    if (!originStop) {
      throw new NotFoundError('Origin stop', originStopId);
    }
    if (!destStop) {
      throw new NotFoundError('Destination stop', destinationStopId);
    }

    // Spatial cluster search: expand both origin and destination into complete stop clusters
    const [fromClusterStops, toClusterStops] = await Promise.all([
      this.stopRepo.findClusterStops
        ? this.stopRepo.findClusterStops(originStopId, radiusM)
        : this.stopRepo.findNearby(originStop.latitude, originStop.longitude, radiusM),
      this.stopRepo.findClusterStops
        ? this.stopRepo.findClusterStops(destinationStopId, radiusM)
        : this.stopRepo.findNearby(destStop.latitude, destStop.longitude, radiusM),
    ]);

    const originStopIds = Array.from(new Set([originStopId, ...fromClusterStops.map((s) => s.stopId)]));
    const destStopIds = Array.from(new Set([destinationStopId, ...toClusterStops.map((s) => s.stopId)]));

    const journeys = await this.routeRepo.findDirectJourneysBetweenStopSets(
      originStopIds,
      destStopIds,
    );

    // Group by route so all distinct matching routes between the clusters are visible
    const routeBestJourney = new Map<string, DirectJourneyResult>();
    for (const j of journeys) {
      if (j.originStop.stopId === j.destinationStop.stopId) continue;
      const routeId = j.route.routeId;
      const existing = routeBestJourney.get(routeId);
      if (!existing || j.stopsBetween < existing.stopsBetween) {
        routeBestJourney.set(routeId, j);
      }
    }

    return Array.from(routeBestJourney.values()).sort(
      (a, b) => a.stopsBetween - b.stopsBetween,
    );
  }

  async findJourneysByCoordinates(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    radiusM = 800,
  ): Promise<DirectJourneyResult[]> {
    const [originStops, destStops] = await Promise.all([
      this.stopRepo.findNearby(fromLat, fromLon, radiusM),
      this.stopRepo.findNearby(toLat, toLon, radiusM),
    ]);

    if (originStops.length === 0 || destStops.length === 0) {
      return [];
    }

    const originStopIds = originStops.map((s) => s.stopId);
    const destStopIds = destStops.map((s) => s.stopId);

    // Perform batched single-query corridor lookup across all cluster stops
    const journeys = await this.routeRepo.findDirectJourneysBetweenStopSets(
      originStopIds,
      destStopIds,
    );

    // Group by route so all distinct matching routes between both stop clusters are visible
    const routeBestJourney = new Map<string, DirectJourneyResult>();
    for (const j of journeys) {
      if (j.originStop.stopId === j.destinationStop.stopId) continue;
      const routeId = j.route.routeId;
      const existing = routeBestJourney.get(routeId);
      if (!existing || j.stopsBetween < existing.stopsBetween) {
        routeBestJourney.set(routeId, j);
      }
    }

    return Array.from(routeBestJourney.values()).sort(
      (a, b) => a.stopsBetween - b.stopsBetween,
    );
  }
}
