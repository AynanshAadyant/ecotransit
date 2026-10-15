import type { Pool } from 'pg';
import { BaseRepository } from '@ecotransit/data-access';
import type { TimeBucket } from '@ecotransit/contracts';
import type {
  ITraversalMatrixRepository,
  EtaResult,
  SegmentHeat,
} from './contracts.js';

interface RawSumResult {
  eta_seconds: number | string;
  variance_total: number | string;
  weakest_cell_support: number | string;
}

interface RawHeatmapRow {
  segment_id: number;
  distance_meters: number;
  duration_seconds: number;
}

export class PostgresTraversalMatrixRepository
  extends BaseRepository
  implements ITraversalMatrixRepository
{
  constructor(
    pool: Pool,
    private readonly sampleThreshold = 30,
    private readonly defaultSpeedMetersPerSec = 8.33,
  ) {
    super(pool);
  }

  async sumTraversal(segmentIds: number[], bucket: TimeBucket): Promise<EtaResult> {
    if (!segmentIds || segmentIds.length === 0) {
      return {
        etaSeconds: 0,
        varianceTotal: 0,
        weakestCellSupport: 0,
      };
    }

    const sql = `
      SELECT COALESCE(SUM(
               CASE
                 WHEN m.sample_count > $3 THEN m.ml_predicted_seconds
                 WHEN m.sample_count > 0  THEN m.naive_avg_seconds
                 ELSE s.distance_meters / $4
               END
             ), 0) AS eta_seconds,
             COALESCE(SUM(m.variance_score), 0) AS variance_total,
             COALESCE(MIN(m.sample_count), 0) AS weakest_cell_support
      FROM route_segments s
      LEFT JOIN route_segment_traversal_matrix m
             ON m.segment_id = s.segment_id
            AND m.hour_of_day = $1
            AND m.day_type = $2
      WHERE s.segment_id = ANY($5::int[]);
    `;

    const row = await this.queryOne<RawSumResult>(sql, [
      bucket.hourOfDay,
      bucket.dayType,
      this.sampleThreshold,
      this.defaultSpeedMetersPerSec,
      segmentIds,
    ]);

    if (!row) {
      return {
        etaSeconds: 0,
        varianceTotal: 0,
        weakestCellSupport: 0,
      };
    }

    return {
      etaSeconds: Math.round(Number(row.eta_seconds) * 10) / 10,
      varianceTotal: Math.round(Number(row.variance_total) * 100) / 100,
      weakestCellSupport: Number(row.weakest_cell_support),
    };
  }

  async fetchHeatmapForRoute(routeId: string, bucket: TimeBucket): Promise<SegmentHeat[]> {
    const sql = `
      SELECT s.segment_id, s.distance_meters,
             COALESCE(
               CASE
                 WHEN m.sample_count > $3 THEN m.ml_predicted_seconds
                 WHEN m.sample_count > 0  THEN m.naive_avg_seconds
                 ELSE s.distance_meters / $4
               END,
               s.distance_meters / $4
             ) AS duration_seconds
      FROM route_segments s
      LEFT JOIN route_segment_traversal_matrix m
             ON m.segment_id = s.segment_id
            AND m.hour_of_day = $1
            AND m.day_type = $2
      WHERE s.route_id = $5
      ORDER BY s.sequence ASC;
    `;

    const rows = await this.query<RawHeatmapRow>(sql, [
      bucket.hourOfDay,
      bucket.dayType,
      this.sampleThreshold,
      this.defaultSpeedMetersPerSec,
      routeId,
    ]);

    return rows.map((r) => {
      const duration = Number(r.duration_seconds) || 1.0;
      const distance = Number(r.distance_meters);
      const speedKmh = Math.round((distance / duration) * 3.6 * 10) / 10;

      // Congestion score (0.0 to 1.0): 1.0 is heavy congestion (speed <= 5 km/h), 0.0 is free flow (speed >= 40 km/h)
      const congestionScore = Math.max(0.0, Math.min(1.0, 1.0 - (speedKmh - 5) / 35));

      return {
        segmentId: r.segment_id,
        averageSpeedKmh: speedKmh,
        congestionScore: Math.round(congestionScore * 100) / 100,
      };
    });
  }
}
