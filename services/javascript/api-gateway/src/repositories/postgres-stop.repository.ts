import type { Pool } from 'pg';
import { BaseRepository } from '@ecotransit/data-access';
import { NotFoundError } from '@ecotransit/core-utils';
import type {
  IStopRepository,
  Stop,
  NearestStopResult,
  RouteSummary,
} from './contracts.js';

interface RawStopRow {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  cluster_id: string | null;
  distance_meters?: number;
}

interface RawRouteRow {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
}

interface RawRouteStopCandidate {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_sequence: number;
  distance_meters: number;
}

export class PostgresStopRepository extends BaseRepository implements IStopRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findById(stopId: string): Promise<Stop | null> {
    const sql = `
      SELECT stop_id, stop_name, latitude, longitude, cluster_id
      FROM stops
      WHERE stop_id = $1;
    `;
    const row = await this.queryOne<RawStopRow>(sql, [stopId]);
    if (!row) return null;

    return this.mapRowToStop(row);
  }

  async findNearby(lat: number, lon: number, radiusM: number, limit = 150): Promise<Stop[]> {
    // Haversine formula SQL query
    const sql = `
      SELECT stop_id, stop_name, latitude, longitude, cluster_id,
             (6371000 * acos(
               LEAST(1.0, GREATEST(-1.0,
                 cos(radians($1)) * cos(radians(latitude)) *
                 cos(radians(longitude) - radians($2)) +
                 sin(radians($1)) * sin(radians(latitude))
               ))
             )) AS distance_meters
      FROM stops
      WHERE (6371000 * acos(
               LEAST(1.0, GREATEST(-1.0,
                 cos(radians($1)) * cos(radians(latitude)) *
                 cos(radians(longitude) - radians($2)) +
                 sin(radians($1)) * sin(radians(latitude))
               ))
             )) <= $3
      ORDER BY distance_meters ASC
      LIMIT $4;
    `;
    const rows = await this.query<RawStopRow>(sql, [lat, lon, radiusM, limit]);
    return rows.map((r) => this.mapRowToStop(r));
  }

  async findNearestOnRoute(
    routeId: string,
    lat: number,
    lon: number,
    bearing?: number,
  ): Promise<NearestStopResult> {
    const sql = `
      SELECT s.stop_id, s.stop_name, s.latitude, s.longitude, rs.stop_sequence,
             (6371000 * acos(
               LEAST(1.0, GREATEST(-1.0,
                 cos(radians($1)) * cos(radians(s.latitude)) *
                 cos(radians(s.longitude) - radians($2)) +
                 sin(radians($1)) * sin(radians(s.latitude))
               ))
             )) AS distance_meters
      FROM route_stops rs
      JOIN stops s ON s.stop_id = rs.stop_id
      WHERE rs.route_id = $3
      ORDER BY distance_meters ASC;
    `;
    const candidates = await this.query<RawRouteStopCandidate>(sql, [lat, lon, routeId]);
    if (candidates.length === 0) {
      throw new NotFoundError(`No stops found on route '${routeId}'`);
    }

    const nearestCandidate = candidates[0]!;

    // Direction-aware stop resolution (Open Decision §13)
    if (bearing !== undefined && candidates.length > 1) {
      const rad = (bearing * Math.PI) / 180;
      const vLon = Math.sin(rad); // East-West vector
      const vLat = Math.cos(rad); // North-South vector

      const uLat = nearestCandidate.latitude - lat;
      const uLon = nearestCandidate.longitude - lon;

      const dotProduct = uLon * vLon + uLat * vLat;

      // If dotProduct < 0, the closest stop is behind the moving vehicle.
      // Advance to the next downstream stop sequence on this route.
      if (dotProduct < 0) {
        const currentSeq = nearestCandidate.stop_sequence;
        const downstreamCandidates = candidates
          .filter((c) => c.stop_sequence > currentSeq)
          .sort((a, b) => a.stop_sequence - b.stop_sequence);
        const nextCandidate = downstreamCandidates[0];
        if (nextCandidate) {
          return {
            stopId: nextCandidate.stop_id,
            stopSequence: nextCandidate.stop_sequence,
            distanceMeters: nextCandidate.distance_meters,
          };
        }
      }
    }

    return {
      stopId: nearestCandidate.stop_id,
      stopSequence: nearestCandidate.stop_sequence,
      distanceMeters: nearestCandidate.distance_meters,
    };
  }

  async findRoutesServingStop(stopId: string): Promise<RouteSummary[]> {
    const sql = `
      SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_type
      FROM route_stops rs
      JOIN routes r ON r.route_id = rs.route_id
      WHERE rs.stop_id = $1
      ORDER BY r.route_short_name ASC;
    `;
    const rows = await this.query<RawRouteRow>(sql, [stopId]);
    return rows.map((r) => ({
      routeId: r.route_id,
      routeShortName: r.route_short_name,
      routeLongName: r.route_long_name,
      routeType: r.route_type,
    }));
  }

  async searchByName(queryStr: string, limit = 20): Promise<Stop[]> {
    const sql = `
      SELECT stop_id, stop_name, latitude, longitude, cluster_id
      FROM stops
      WHERE stop_name ILIKE '%' || $1 || '%'
      ORDER BY stop_name ASC
      LIMIT $2;
    `;
    const rows = await this.query<RawStopRow>(sql, [queryStr, limit]);
    return rows.map((r) => this.mapRowToStop(r));
  }

  async findClusterStops(stopId: string, radiusM = 800): Promise<Stop[]> {
    const baseStop = await this.findById(stopId);
    if (!baseStop) return [];

    const baseName = baseStop.stopName
      ? baseStop.stopName.split('(')[0]?.trim().toLowerCase()
      : '';

    // Spatial cluster search:
    // 1. Exact stop ID
    // 2. Stops sharing the same GTFS cluster_id (if present)
    // 3. Stops within the spatial search radius (e.g. 800m) of this stop
    // 4. Stops sharing the same base name within 2km (opposite platforms, cluster points)
    const sql = `
      SELECT stop_id, stop_name, latitude, longitude, cluster_id,
             (6371000 * acos(
               LEAST(1.0, GREATEST(-1.0,
                 cos(radians($2)) * cos(radians(latitude)) *
                 cos(radians(longitude) - radians($3)) +
                 sin(radians($2)) * sin(radians(latitude))
               ))
             )) AS distance_meters
      FROM stops
      WHERE stop_id = $1
        OR ($4::text IS NOT NULL AND cluster_id = $4)
        OR (6371000 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians($2)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($3)) +
                sin(radians($2)) * sin(radians(latitude))
              ))
            )) <= $5
        OR (
          $6::text <> '' AND stop_name ILIKE '%' || $6 || '%'
          AND (6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                  cos(radians($2)) * cos(radians(latitude)) *
                  cos(radians(longitude) - radians($3)) +
                  sin(radians($2)) * sin(radians(latitude))
                ))
              )) <= 2000
        )
      ORDER BY distance_meters ASC
      LIMIT 100;
    `;

    const rows = await this.query<RawStopRow>(sql, [
      stopId,
      baseStop.latitude,
      baseStop.longitude,
      baseStop.clusterId || null,
      radiusM,
      baseName,
    ]);

    return rows.map((r) => this.mapRowToStop(r));
  }

  private mapRowToStop(row: RawStopRow): Stop {
    return {
      stopId: row.stop_id,
      stopName: row.stop_name,
      displayName: row.cluster_id ? `${row.stop_name} (${row.cluster_id})` : row.stop_name,
      latitude: row.latitude,
      longitude: row.longitude,
      clusterId: row.cluster_id || undefined,
    };
  }
}
