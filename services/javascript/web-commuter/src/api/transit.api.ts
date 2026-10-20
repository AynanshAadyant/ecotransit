import { apiClient } from './client.js';
import {
  Vehicle,
  JourneyResult,
  EtaResponse,
  Stop,
  RouteGeometry,
  HeatmapBucket,
  RouteSummary,
  DirectJourneyResult,
  StopSchema,
  RouteSummarySchema,
  DirectJourneyResultSchema,
  EtaResultSchema,
  VehiclePositionSchema,
  SearchStopsQuerySchema,
  NearbyStopsQuerySchema,
  RouteIdParamSchema,
  StopIdParamSchema,
  VehicleIdParamSchema,
  GetVehicleEtaSchema,
  DirectJourneyQuerySchema,
  JourneyByCoordsQuerySchema,
} from '@ecotransit/contracts';

// ---------------------------------------------------------------------------
// Helpers: Color palette for dynamic routes
// ---------------------------------------------------------------------------
function getRouteColor(routeId: string): string {
  if (routeId.includes('M1')) return '#f5c518'; // Yellow Line
  if (routeId.includes('M2')) return '#2563eb'; // Blue Line
  if (routeId.includes('M3')) return '#dc2626'; // Red Line
  if (routeId.includes('M5')) return '#7c3aed'; // Violet Line
  if (routeId.includes('M6')) return '#ec4899'; // Pink Line
  if (routeId.includes('501') || routeId.includes('521')) return '#f97316';
  if (routeId.includes('615')) return '#06b6d4';
  if (routeId.includes('423')) return '#a855f7';
  if (routeId.includes('764')) return '#84cc16';

  const hash = Array.from(routeId).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = [
    '#10b981', '#38bdf8', '#f59e0b', '#ec4899', '#8b5cf6',
    '#06b6d4', '#f43f5e', '#a3e635', '#fb923c', '#2dd4bf',
  ];
  return palette[hash % palette.length] ?? '#10b981';
}

// ---------------------------------------------------------------------------
// 1. Routes API
// ---------------------------------------------------------------------------

export async function getRoutes(): Promise<RouteGeometry[]> {
  try {
    const response = await apiClient.get<RouteSummary[]>('/routes');
    if (!Array.isArray(response.data)) {
      return [];
    }

    const validatedRoutes: RouteGeometry[] = [];
    for (const raw of response.data) {
      const parsed = RouteSummarySchema.safeParse(raw);
      if (parsed.success) {
        const r = parsed.data;
        const name = r.routeLongName
          ? `${r.routeShortName} (${r.routeLongName})`
          : r.routeShortName || r.routeId;

        validatedRoutes.push({
          routeId: r.routeId,
          name,
          color: getRouteColor(r.routeId),
          path: [],
        });
      }
    }

    return validatedRoutes;
  } catch (error) {
    console.warn('[Transit API] Failed to fetch routes from backend:', error);
    return [];
  }
}

export async function getRouteStops(routeId: string): Promise<Stop[]> {
  // Zero-trust client-side validation
  const validation = RouteIdParamSchema.safeParse({ routeId });
  if (!validation.success) {
    throw new Error(`Invalid route ID: ${validation.error.message}`);
  }

  try {
    const response = await apiClient.get<Stop[]>(`/routes/${encodeURIComponent(routeId)}/stops`);
    if (!Array.isArray(response.data)) {
      return [];
    }

    const stops: Stop[] = [];
    for (const raw of response.data) {
      const parsed = StopSchema.safeParse(raw);
      if (parsed.success) {
        stops.push(parsed.data);
      }
    }
    return stops;
  } catch (error) {
    console.warn(`[Transit API] Failed to fetch stops for route ${routeId}:`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. Stops API
// ---------------------------------------------------------------------------

export async function getStops(radius = 5000, lat = 28.6139, lon = 77.2090, limit = 150): Promise<Stop[]> {
  // Zero-trust client-side validation
  const query = NearbyStopsQuerySchema.safeParse({ lat, lon, radius, limit });
  if (!query.success) {
    console.warn('[Transit API] Invalid nearby stops query parameters:', query.error);
    return [];
  }

  try {
    const response = await apiClient.get<Stop[]>('/stops/nearby', {
      params: query.data,
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    const stops: Stop[] = [];
    for (const raw of response.data) {
      const parsed = StopSchema.safeParse(raw);
      if (parsed.success) {
        stops.push(parsed.data);
      }
    }
    return stops;
  } catch (error) {
    console.warn('[Transit API] Failed to fetch nearby stops from backend:', error);
    return [];
  }
}

export async function searchStops(query: string, limit = 20): Promise<Stop[]> {
  // Zero-trust client-side validation
  const valid = SearchStopsQuerySchema.safeParse({ q: query, limit });
  if (!valid.success) {
    return [];
  }

  try {
    const response = await apiClient.get<Stop[]>('/stops/search', {
      params: valid.data,
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    const stops: Stop[] = [];
    for (const raw of response.data) {
      const parsed = StopSchema.safeParse(raw);
      if (parsed.success) {
        stops.push(parsed.data);
      }
    }
    return stops;
  } catch (error) {
    console.warn('[Transit API] Failed to search stops:', error);
    return [];
  }
}

export async function getStopById(stopId: string): Promise<Stop | null> {
  // Zero-trust validation
  const valid = StopIdParamSchema.safeParse({ stopId });
  if (!valid.success) return null;

  try {
    const response = await apiClient.get<Stop>(`/stops/${encodeURIComponent(stopId)}`);
    const parsed = StopSchema.safeParse(response.data);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.warn(`[Transit API] Failed to fetch stop ${stopId}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Live Vehicles API
// ---------------------------------------------------------------------------

export async function getLiveVehicles(): Promise<Vehicle[]> {
  try {
    const response = await apiClient.get<unknown[]>('/vehicles/live');
    if (!Array.isArray(response.data)) {
      return [];
    }

    const vehicles: Vehicle[] = [];
    for (const raw of response.data) {
      const parsed = VehiclePositionSchema.safeParse(raw);
      if (parsed.success) {
        const v = parsed.data;
        vehicles.push({
          vehicleId: v.vehicleId,
          routeId: v.routeId,
          latitude: v.latitude,
          longitude: v.longitude,
          speed: v.speed,
          heading: v.bearing,
          timestamp: new Date(v.timestamp * 1000).toISOString(),
        });
      }
    }
    return vehicles;
  } catch (error) {
    console.warn('[Transit API] Failed to fetch live vehicles:', error);
    return [];
  }
}

export async function getVehicleById(vehicleId: string): Promise<Vehicle | null> {
  const valid = VehicleIdParamSchema.safeParse({ vehicleId });
  if (!valid.success) return null;

  try {
    const response = await apiClient.get<unknown>(`/vehicles/live/${encodeURIComponent(vehicleId)}`);
    const parsed = VehiclePositionSchema.safeParse(response.data);
    if (!parsed.success) return null;

    const v = parsed.data;
    return {
      vehicleId: v.vehicleId,
      routeId: v.routeId,
      latitude: v.latitude,
      longitude: v.longitude,
      speed: v.speed,
      heading: v.bearing,
      timestamp: new Date(v.timestamp * 1000).toISOString(),
    };
  } catch (error) {
    console.warn(`[Transit API] Failed to fetch vehicle ${vehicleId}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Real-time ETA API
// ---------------------------------------------------------------------------

export async function getEta(vehicleId: string, targetStopId: string): Promise<EtaResponse> {
  // Zero-trust validation
  const valid = GetVehicleEtaSchema.safeParse({ vehicleId, targetStopId });
  if (!valid.success) {
    throw new Error(`Invalid ETA request: ${valid.error.message}`);
  }

  const response = await apiClient.get<unknown>(`/eta/${encodeURIComponent(vehicleId)}`, {
    params: { stopId: targetStopId },
  });

  const parsed = EtaResultSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Received malformed ETA response from server');
  }

  const data = parsed.data;
  return {
    routeId: '',
    segmentId: targetStopId,
    eta_seconds: data.etaSeconds,
    variance_total: data.varianceTotal,
    weakest_cell_support: data.weakestCellSupport,
  };
}

// ---------------------------------------------------------------------------
// 5. Journey Planning API (A to B)
// ---------------------------------------------------------------------------

export async function searchJourney(
  origin: string,
  destination: string,
  originStopParam?: Stop | null,
  destStopParam?: Stop | null,
): Promise<JourneyResult[]> {
  const cleanOrigin = origin.trim();
  const cleanDest = destination.trim();

  if (!cleanOrigin || !cleanDest) {
    return [];
  }

  // 1. Resolve origin and destination stops
  let origStop: Stop | null = originStopParam ?? null;
  let destStop: Stop | null = destStopParam ?? null;

  if (!origStop || !destStop) {
    const [originMatches, destMatches] = await Promise.all([
      origStop ? Promise.resolve([origStop]) : searchStops(cleanOrigin, 5),
      destStop ? Promise.resolve([destStop]) : searchStops(cleanDest, 5),
    ]);

    if ((!origStop && originMatches.length === 0) || (!destStop && destMatches.length === 0)) {
      throw new Error(`Unable to resolve transit stops for "${cleanOrigin}" or "${cleanDest}". Try searching nearby stations.`);
    }

    origStop = origStop ?? originMatches[0]!;
    destStop = destStop ?? destMatches[0]!;
  }

  if (origStop.stopId === destStop.stopId) {
    throw new Error('Origin and destination resolve to the same transit stop.');
  }

  // 2. Perform zero-trust validated query
  const query = DirectJourneyQuerySchema.safeParse({
    originStopId: origStop.stopId,
    destinationStopId: destStop.stopId,
  });

  if (query.success) {
    try {
      const response = await apiClient.get<DirectJourneyResult[]>('/routes/search', {
        params: query.data,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        return mapDirectJourneysToResults(response.data, cleanOrigin, cleanDest);
      }
    } catch {
      // Direct single-line query may 404 or return empty; continue to corridor search
    }
  }

  // 3. Fallback to coordinate-based corridor search (within 1500m of each stop)
  const coordsQuery = JourneyByCoordsQuerySchema.safeParse({
    fromLat: origStop.latitude,
    fromLon: origStop.longitude,
    toLat: destStop.latitude,
    toLon: destStop.longitude,
    radiusM: 1500,
  });

  if (coordsQuery.success) {
    try {
      const coordResp = await apiClient.get<DirectJourneyResult[]>('/routes/search-coords', {
        params: coordsQuery.data,
      });

      if (Array.isArray(coordResp.data) && coordResp.data.length > 0) {
        return mapDirectJourneysToResults(coordResp.data, cleanOrigin, cleanDest);
      }
    } catch {
      // Fall through to error
    }
  }

  throw new Error(`No direct transit service found between ${origStop.displayName || origStop.stopName} and ${destStop.displayName || destStop.stopName}.`);
}

function mapDirectJourneysToResults(
  journeys: DirectJourneyResult[],
  originLabel: string,
  destLabel: string,
): JourneyResult[] {
  const results: JourneyResult[] = [];

  for (let idx = 0; idx < journeys.length; idx++) {
    const raw = journeys[idx]!;
    const parsed = DirectJourneyResultSchema.safeParse(raw);
    if (!parsed.success) continue;

    const j = parsed.data;
    const stopsBetween = Math.max(1, j.stopsBetween);
    const durationMins = Math.round(stopsBetween * 2.5); // ~2.5 mins per stop
    const fare = Math.min(60, Math.max(10, 10 + stopsBetween * 2)); // Progressive transit fare

    results.push({
      journeyId: `journey-${j.route.routeId}-${j.originStop.stopId}-${j.destinationStop.stopId}`,
      origin: j.originStop.displayName || j.originStop.stopName || originLabel,
      destination: j.destinationStop.displayName || j.destinationStop.stopName || destLabel,
      totalDurationMinutes: durationMins,
      fare,
      segments: [
        {
          segmentId: `seg-${j.route.routeId}-${idx}`,
          routeId: j.route.routeId,
          routeName: j.route.routeShortName || j.route.routeLongName || j.route.routeId,
          fromStop: j.originStop.displayName || j.originStop.stopName || originLabel,
          toStop: j.destinationStop.displayName || j.destinationStop.stopName || destLabel,
          departureTime: 'Live',
          arrivalTime: `+${durationMins}m`,
          durationMinutes: durationMins,
        },
      ],
    });
  }

  return results;
}

export async function getHeatmap(_routeId?: string): Promise<HeatmapBucket[]> {
  return [];
}
