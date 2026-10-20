import { BaseController } from '@ecotransit/core-utils';
import {
  NearbyStopsQuerySchema,
  SearchStopsQuerySchema,
  StopIdParamSchema,
} from '../dto/index.js';
import type { StopService } from '../services/stop.service.js';

export class StopController extends BaseController {
  constructor(private readonly stopService: StopService) {
    super();
  }

  getNearby = this.handle(async (req) => {
    const query = NearbyStopsQuerySchema.parse(req.query);
    return this.stopService.getNearbyStops(query.lat, query.lon, query.radius, query.limit);
  });

  search = this.handle(async (req) => {
    const query = SearchStopsQuerySchema.parse(req.query);
    return this.stopService.searchStops(query.q, query.limit);
  });

  getById = this.handle(async (req) => {
    const params = StopIdParamSchema.parse(req.params);
    return this.stopService.getStopById(params.stopId);
  });

  getRoutes = this.handle(async (req) => {
    const params = StopIdParamSchema.parse(req.params);
    return this.stopService.getRoutesForStop(params.stopId);
  });
}
