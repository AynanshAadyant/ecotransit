import type { Pool } from 'pg';
import { BaseRepository } from '@ecotransit/data-access';
import type {
  IRouteRepository,
  RouteSummary,
  Stop,
  DirectJourneyResult,
} from './contracts.js';

interface RawRouteRow {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
}

interface RawRouteStopRow {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  cluster_id: string | null;
  stop_sequence: number;
}

interface RawDirectJourneyRow {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  origin_sequence: number;
  dest_sequence: number;
  stops_between: number;
  orig_stop_id: string;
  orig_stop_name: string;
  orig_lat: number;
  orig_lon: number;
  orig_cluster: string | null;
  dest_stop_id: string;
  dest_stop_name: string;
  dest_lat: number;
  dest_lon: number;
  dest_cluster: string | null;
}

export class PostgresRouteRepository extends BaseRepository implements IRouteRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async findById(routeId: string): Promise<RouteSummary | null> {
    const sql = `
      SELECT route_id, route_short_name, route_long_name, route_type
      FROM routes
      WHERE route_id = $1;
    `;
    const row = await this.queryOne<RawRouteRow>(sql, [routeId]);
    if (!row) return null;

    return {
      routeId: row.route_id,
      routeShortName: row.route_short_name,
      routeLongName: row.route_long_name,
      routeType: row.route_type,
    };
  }

  async findAll(): Promise<RouteSummary[]> {
    const sql = `
      SELECT route_id, route_short_name, route_long_name, route_type
      FROM routes
      ORDER BY route_short_name ASC;
    `;
    const rows = await this.query<RawRouteRow>(sql);
    return rows.map((r) => ({
      routeId: r.route_id,
      routeShortName: r.route_short_name,
      routeLongName: r.route_long_name,
      routeType: r.route_type,
    }));
  }

  async findStopsByRoute(routeId: string): Promise<Stop[]> {
    const sql = `
      SELECT s.stop_id, s.stop_name, s.latitude, s.longitude, s.cluster_id, rs.stop_sequence
      FROM route_stops rs
      JOIN stops s ON s.stop_id = rs.stop_id
      WHERE rs.route_id = $1
      ORDER BY rs.stop_sequence ASC;
    `;
    const rows = await this.query<RawRouteStopRow>(sql, [routeId]);
    return rows.map((r) => ({
      stopId: r.stop_id,
      stopName: r.stop_name,
      displayName: r.cluster_id ? `${r.stop_name} (${r.cluster_id})` : r.stop_name,
      latitude: r.latitude,
      longitude: r.longitude,
      clusterId: r.cluster_id || undefined,
    }));
  }

  async findDirectJourneys(
    originStopId: string,
    destinationStopId: string,
  ): Promise<DirectJourneyResult[]> {
    const sql = `
      SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_type,
             rs_orig.stop_sequence AS origin_sequence,
             rs_dest.stop_sequence AS dest_sequence,
             (rs_dest.stop_sequence - rs_orig.stop_sequence) AS stops_between,
             orig_s.stop_id AS orig_stop_id, orig_s.stop_name AS orig_stop_name,
             orig_s.latitude AS orig_lat, orig_s.longitude AS orig_lon, orig_s.cluster_id AS orig_cluster,
             dest_s.stop_id AS dest_stop_id, dest_s.stop_name AS dest_stop_name,
             dest_s.latitude AS dest_lat, dest_s.longitude AS dest_lon, dest_s.cluster_id AS dest_cluster
      FROM route_stops rs_orig
      JOIN route_stops rs_dest ON rs_orig.route_id = rs_dest.route_id
      JOIN routes r ON r.route_id = rs_orig.route_id
      JOIN stops orig_s ON orig_s.stop_id = rs_orig.stop_id
      JOIN stops dest_s ON dest_s.stop_id = rs_dest.stop_id
      WHERE rs_orig.stop_id = $1
        AND rs_dest.stop_id = $2
        AND rs_orig.stop_sequence < rs_dest.stop_sequence
      ORDER BY stops_between ASC;
    `;
    const rows = await this.query<RawDirectJourneyRow>(sql, [originStopId, destinationStopId]);
    return rows.map((r) => ({
      route: {
        routeId: r.route_id,
        routeShortName: r.route_short_name,
        routeLongName: r.route_long_name,
        routeType: r.route_type,
      },
      originStop: {
        stopId: r.orig_stop_id,
        stopName: r.orig_stop_name,
        displayName: r.orig_cluster ? `${r.orig_stop_name} (${r.orig_cluster})` : r.orig_stop_name,
        latitude: r.orig_lat,
        longitude: r.orig_lon,
        clusterId: r.orig_cluster || undefined,
      },
      destinationStop: {
        stopId: r.dest_stop_id,
        stopName: r.dest_stop_name,
        displayName: r.dest_cluster ? `${r.dest_stop_name} (${r.dest_cluster})` : r.dest_stop_name,
        latitude: r.dest_lat,
        longitude: r.dest_lon,
        clusterId: r.dest_cluster || undefined,
      },
      originSequence: r.origin_sequence,
      destinationSequence: r.dest_sequence,
      stopsBetween: r.stops_between,
    }));
  }
}
