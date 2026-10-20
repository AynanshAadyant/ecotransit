import { BaseController } from '@ecotransit/core-utils';
import {
  RouteIdParamSchema,
  DirectJourneyQuerySchema,
  JourneyByCoordsQuerySchema,
} from '../dto/index.js';
import type { RouteService } from '../services/route.service.js';

export class RouteController extends BaseController {
  constructor(private readonly routeService: RouteService) {
    super();
  }

  getAll = this.handle(async () => {
    return this.routeService.getAllRoutes();
  });

  getById = this.handle(async (req) => {
    const params = RouteIdParamSchema.parse(req.params);
    return this.routeService.getRouteById(params.routeId);
  });

  getStops = this.handle(async (req) => {
    const params = RouteIdParamSchema.parse(req.params);
    return this.routeService.getStopsForRoute(params.routeId);
  });

  searchJourneys = this.handle(async (req) => {
    const query = DirectJourneyQuerySchema.parse(req.query);
    return this.routeService.findJourneys(
      query.originStopId,
      query.destinationStopId,
      query.radiusM ?? 800,
    );
  });

  searchJourneysByCoords = this.handle(async (req) => {
    const query = JourneyByCoordsQuerySchema.parse(req.query);
    return this.routeService.findJourneysByCoordinates(
      query.fromLat,
      query.fromLon,
      query.toLat,
      query.toLon,
      query.radiusM,
    );
  });
}
