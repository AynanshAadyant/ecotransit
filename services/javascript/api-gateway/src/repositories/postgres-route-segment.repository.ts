import type { Pool } from 'pg';
import { BaseRepository } from '@ecotransit/data-access';
import type {
  IRouteSegmentRepository,
  RouteSegment,
  RemainingSegmentsRequest,
} from './contracts.js';

interface RawSegmentRow {
  segment_id: number;
  route_id: string;
  from_stop_id: string;
  to_stop_id: string;
  sequence: number;
  distance_meters: number;
}

interface TargetSequenceRow {
  stop_sequence: number;
}

export class PostgresRouteSegmentRepository
  extends BaseRepository
  implements IRouteSegmentRepository
{
  constructor(pool: Pool) {
    super(pool);
  }

  async findRemaining(
    routeId: string,
    fromSequence: number,
    targetStopId: string,
  ): Promise<RouteSegment[]> {
    // 1. Find target stop's sequence on route
    const targetSeqSql = `
      SELECT stop_sequence
      FROM route_stops
      WHERE route_id = $1 AND stop_id = $2;
    `;
    const targetRow = await this.queryOne<TargetSequenceRow>(targetSeqSql, [
      routeId,
      targetStopId,
    ]);
    if (!targetRow) {
      return [];
    }

    const targetSequence = targetRow.stop_sequence;
    if (targetSequence <= fromSequence) {
      return []; // Target stop is not downstream
    }

    // 2. Fetch segments between fromSequence and targetSequence
    const sql = `
      SELECT segment_id, route_id, from_stop_id, to_stop_id, sequence, distance_meters
      FROM route_segments
      WHERE route_id = $1
        AND sequence >= $2
        AND sequence < $3
      ORDER BY sequence ASC;
    `;
    const rows = await this.query<RawSegmentRow>(sql, [routeId, fromSequence, targetSequence]);
    return rows.map((r) => this.mapRowToSegment(r));
  }

  async findRemainingForMany(
    requests: RemainingSegmentsRequest[],
  ): Promise<Map<string, RouteSegment[]>> {
    const resultMap = new Map<string, RouteSegment[]>();
    if (!requests || requests.length === 0) {
      return resultMap;
    }

    // Batch query: process requests sequentially or via unnest/IN clause
    for (const req of requests) {
      const segments = await this.findRemaining(
        req.routeId,
        req.fromSequence,
        req.targetStopId,
      );
      resultMap.set(req.vehicleId, segments);
    }

    return resultMap;
  }

  private mapRowToSegment(row: RawSegmentRow): RouteSegment {
    return {
      segmentId: row.segment_id,
      routeId: row.route_id,
      fromStopId: row.from_stop_id,
      toStopId: row.to_stop_id,
      sequence: row.sequence,
      distanceMeters: row.distance_meters,
    };
  }
}
