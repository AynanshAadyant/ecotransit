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

    return this.routeRepo.findDirectJourneys(originStopId, destinationStopId);
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

    const journeyMap = new Map<string, DirectJourneyResult>();

    for (const orig of originStops) {
      for (const dest of destStops) {
        if (orig.stopId === dest.stopId) continue;
        const journeys = await this.routeRepo.findDirectJourneys(orig.stopId, dest.stopId);
        for (const j of journeys) {
          const key = `${j.route.routeId}:${j.originStop.stopId}:${j.destinationStop.stopId}`;
          if (!journeyMap.has(key)) {
            journeyMap.set(key, j);
          }
        }
      }
    }

    return Array.from(journeyMap.values()).sort(
      (a, b) => a.stopsBetween - b.stopsBetween,
    );
  }
}
