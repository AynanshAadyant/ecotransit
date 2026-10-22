import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { Client } from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'ecotransit',
};

async function seed() {
  const client = new Client(config);
  console.log(`[Seed] Connecting to database ${config.database} on ${config.host}:${config.port}...`);

  try {
    await client.connect();
    console.log('[Seed] Connected successfully.');

    const seedsDir = path.resolve(__dirname, 'seeds');
    const artifactsDir = path.resolve(__dirname, '../services/python/intelligence-job/artifacts');

    const routesCsv = path.join(seedsDir, 'routes.csv');
    const stopClusteringCsv = path.join(artifactsDir, 'stop_clustering_map.csv');
    const segmentsCsv = path.join(artifactsDir, 'static_route_segments.csv');

    if (!fs.existsSync(routesCsv)) throw new Error(`Missing ${routesCsv}`);
    if (!fs.existsSync(stopClusteringCsv)) throw new Error(`Missing ${stopClusteringCsv}`);
    if (!fs.existsSync(segmentsCsv)) throw new Error(`Missing ${segmentsCsv}`);

    // =========================================================================
    // 1. SEED ROUTES
    // =========================================================================
    console.log('\n[1/4] Seeding routes...');
    const routeRl = readline.createInterface({
      input: fs.createReadStream(routesCsv),
      crlfDelay: Infinity,
    });

    let routeRows: Array<{ route_id: string; route_short_name: string; route_long_name: string; route_type: number }> = [];
    let isHeader = true;

    for await (const line of routeRl) {
      if (isHeader) { isHeader = false; continue; }
      const parts = line.split(',');
      if (parts.length < 5) continue;
      const [_agency, route_id, route_long, route_short, route_type] = parts;
      const rid = route_id.trim();
      if (!rid) continue;
      const shortName = (route_short || route_long || rid).trim();
      const longName = (route_long || route_short || rid).trim();
      const rtype = parseInt(route_type, 10) || 3;
      routeRows.push({ route_id: rid, route_short_name: shortName, route_long_name: longName, route_type: rtype });
    }

    // Insert routes in batches
    console.log(`  Parsed ${routeRows.length} routes. Inserting into PostgreSQL...`);
    const routeBatchSize = 500;
    for (let i = 0; i < routeRows.length; i += routeBatchSize) {
      const batch = routeRows.slice(i, i + routeBatchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let pIdx = 1;

      for (const r of batch) {
        placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        values.push(r.route_id, r.route_short_name, r.route_long_name, r.route_type);
      }

      const sql = `
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (route_id) DO UPDATE SET
          route_short_name = EXCLUDED.route_short_name,
          route_long_name = EXCLUDED.route_long_name,
          route_type = EXCLUDED.route_type
      `;
      await client.query(sql, values);
    }
    console.log(`  ✓ Successfully seeded routes.`);

    // =========================================================================
    // 2. SEED STOPS (from stop_clustering_map.csv)
    // =========================================================================
    console.log('\n[2/4] Seeding stops (clustered)...');
    const stopRl = readline.createInterface({
      input: fs.createReadStream(stopClusteringCsv),
      crlfDelay: Infinity,
    });

    interface StopRow {
      stop_id: string;
      stop_name: string;
      latitude: number;
      longitude: number;
      cluster_id: string;
    }
    const stopRows: StopRow[] = [];
    isHeader = true;

    for await (const line of stopRl) {
      if (isHeader) { isHeader = false; continue; }
      const parts = line.split(',');
      if (parts.length < 5) continue;
      const [raw_stop_id, cluster_id, canonical_name, cluster_lat, cluster_lon] = parts;
      const sid = raw_stop_id.trim();
      if (!sid) continue;
      stopRows.push({
        stop_id: sid,
        stop_name: canonical_name.trim() || `Stop ${sid}`,
        latitude: parseFloat(cluster_lat),
        longitude: parseFloat(cluster_lon),
        cluster_id: cluster_id.trim() || sid,
      });
    }

    console.log(`  Parsed ${stopRows.length} stops. Inserting into PostgreSQL...`);
    const stopBatchSize = 500;
    for (let i = 0; i < stopRows.length; i += stopBatchSize) {
      const batch = stopRows.slice(i, i + stopBatchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let pIdx = 1;

      for (const s of batch) {
        placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        values.push(s.stop_id, s.stop_name, s.latitude, s.longitude, s.cluster_id);
      }

      const sql = `
        INSERT INTO stops (stop_id, stop_name, latitude, longitude, cluster_id)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (stop_id) DO UPDATE SET
          stop_name = EXCLUDED.stop_name,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          cluster_id = EXCLUDED.cluster_id
      `;
      await client.query(sql, values);
    }
    console.log(`  ✓ Successfully seeded stops.`);

    // =========================================================================
    // 3. SEED ROUTE SEGMENTS & ROUTE STOPS
    // =========================================================================
    console.log('\n[3/4] Seeding route segments (enforcing >= 25.0m invariant)...');
    const segRl = readline.createInterface({
      input: fs.createReadStream(segmentsCsv),
      crlfDelay: Infinity,
    });

    interface SegmentRow {
      segment_id: number;
      route_id: string;
      sequence: number;
      from_stop_id: string;
      to_stop_id: string;
      distance_meters: number;
    }
    const segRows: SegmentRow[] = [];
    isHeader = true;

    // Track route stops sequences
    const routeStopMap = new Map<string, Map<number, string>>();

    for await (const line of segRl) {
      if (isHeader) { isHeader = false; continue; }
      const parts = line.split(',');
      if (parts.length < 7) continue;
      const [segId, routeId, _dirId, seq, fromStop, toStop, dist] = parts;
      const distance = Math.max(25.0, parseFloat(dist) || 25.0); // Strict >= 25.0m clustering radius invariant
      const sId = parseInt(segId, 10);
      const rId = routeId.trim();
      const sequenceNum = parseInt(seq, 10);
      const fromS = fromStop.trim();
      const toS = toStop.trim();

      segRows.push({
        segment_id: sId,
        route_id: rId,
        sequence: sequenceNum,
        from_stop_id: fromS,
        to_stop_id: toS,
        distance_meters: distance,
      });

      if (!routeStopMap.has(rId)) {
        routeStopMap.set(rId, new Map());
      }
      const stopsForRoute = routeStopMap.get(rId)!;
      stopsForRoute.set(sequenceNum, fromS);
      stopsForRoute.set(sequenceNum + 1, toS);
    }

    console.log(`  Parsed ${segRows.length} segments. Inserting into PostgreSQL...`);
    const segBatchSize = 1000;
    for (let i = 0; i < segRows.length; i += segBatchSize) {
      const batch = segRows.slice(i, i + segBatchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let pIdx = 1;

      for (const seg of batch) {
        placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        values.push(seg.segment_id, seg.route_id, seg.from_stop_id, seg.to_stop_id, seg.sequence, seg.distance_meters);
      }

      const sql = `
        INSERT INTO route_segments (segment_id, route_id, from_stop_id, to_stop_id, sequence, distance_meters)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (route_id, sequence) DO UPDATE SET
          segment_id = EXCLUDED.segment_id,
          from_stop_id = EXCLUDED.from_stop_id,
          to_stop_id = EXCLUDED.to_stop_id,
          distance_meters = EXCLUDED.distance_meters
      `;
      await client.query(sql, values);
    }

    // Reset serial sequence for route_segments
    await client.query(`
      SELECT setval(pg_get_serial_sequence('route_segments', 'segment_id'), COALESCE((SELECT MAX(segment_id) FROM route_segments), 1));
    `);
    console.log(`  ✓ Successfully seeded route_segments.`);

    // =========================================================================
    // 4. SEED ROUTE STOPS
    // =========================================================================
    console.log('\n[4/4] Seeding route stops...');
    interface RouteStopEntry {
      route_id: string;
      stop_id: string;
      stop_sequence: number;
    }
    const routeStopEntries: RouteStopEntry[] = [];

    for (const [rId, stopSeqMap] of routeStopMap.entries()) {
      const sortedSeqs = Array.from(stopSeqMap.keys()).sort((a, b) => a - b);
      for (let idx = 0; idx < sortedSeqs.length; idx++) {
        const seq = sortedSeqs[idx]!;
        const stopId = stopSeqMap.get(seq)!;
        routeStopEntries.push({
          route_id: rId,
          stop_id: stopId,
          stop_sequence: idx,
        });
      }
    }

    console.log(`  Constructed ${routeStopEntries.length} route_stops entries. Inserting into PostgreSQL...`);
    const routeStopBatchSize = 1000;
    for (let i = 0; i < routeStopEntries.length; i += routeStopBatchSize) {
      const batch = routeStopEntries.slice(i, i + routeStopBatchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let pIdx = 1;

      for (const rs of batch) {
        placeholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++})`);
        values.push(rs.route_id, rs.stop_id, rs.stop_sequence);
      }

      const sql = `
        INSERT INTO route_stops (route_id, stop_id, stop_sequence)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (route_id, stop_sequence) DO UPDATE SET
          stop_id = EXCLUDED.stop_id
      `;
      await client.query(sql, values);
    }
    console.log(`  ✓ Successfully seeded route_stops.`);

    // =========================================================================
    // FINAL AUDIT
    // =========================================================================
    console.log('\n=== SEED AUDIT SUMMARY ===');
    const counts = await Promise.all([
      client.query<{ count: string }>('SELECT COUNT(*) FROM routes'),
      client.query<{ count: string }>('SELECT COUNT(*) FROM stops'),
      client.query<{ count: string }>('SELECT COUNT(*) FROM route_segments'),
      client.query<{ count: string }>('SELECT COUNT(*) FROM route_stops'),
    ]);

    console.log(`  Routes count:         ${counts[0].rows[0]?.count}`);
    console.log(`  Stops count:          ${counts[1].rows[0]?.count}`);
    console.log(`  Route Segments count: ${counts[2].rows[0]?.count}`);
    console.log(`  Route Stops count:    ${counts[3].rows[0]?.count}`);
    console.log('\n[Seed] Complete! Database is populated with live GTFS static graph.\n');

  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
