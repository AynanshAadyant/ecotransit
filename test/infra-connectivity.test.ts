import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  createPool,
  createRedisClient,
  vehicleLiveKey,
  vehicleGeoKey,
} from '@ecotransit/data-access';
import type { Pool } from 'pg';
import type { RedisClientType } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('Phase 0 Infrastructure: End-to-End Joint Infra Connectivity & Validation', () => {
  let pool: Pool;
  let redis: RedisClientType;

  before(async () => {
    pool = createPool({ max: 5 });
    redis = createRedisClient();
    await redis.connect();
  });

  after(async () => {
    if (redis && redis.isOpen) {
      await redis.quit();
    }
    if (pool) {
      await pool.end();
    }
  });

  it('should verify concurrent health check across both database and cache', async () => {
    const started = performance.now();

    const [dbResult, redisResult] = await Promise.all([
      pool.query<{ alive: number }>('SELECT 1 as alive'),
      redis.ping(),
    ]);

    const duration = performance.now() - started;

    assert.equal(dbResult.rows[0]?.alive, 1, 'PostgreSQL must respond to query');
    assert.equal(redisResult, 'PONG', 'Redis must respond to ping');
    assert.ok(duration < 2000, `Health check latency should be < 2000ms, took ${duration.toFixed(2)}ms`);
  });

  it('should validate end-to-end fan-out ingestion write to both Redis (hot) and PostgreSQL (durable archive)', async () => {
    // 1a. Insert a dummy route and vehicle into legacy schema to satisfy foreign key constraints
    const routeInsert = await pool.query<{ id: number }>('INSERT INTO routes (name, route_code) VALUES ($1, $2) RETURNING id', ['Test Route', 'TEST-419']);
    const routeId = routeInsert.rows[0]!.id;
    const vehicleInsert = await pool.query<{ id: number }>('INSERT INTO vehicles (vehicle_number, registration_number, route_id) VALUES ($1, $2, $3) RETURNING id', ['DL1PC8888_TEST', 'REG_DL1PC8888', routeId]);
    const vehicleId = vehicleInsert.rows[0]!.id;

    const lat = 28.6315; // Connaught Place
    const lon = 77.2167;
    const speed = 14.2;
    const bearing = 90.0;
    const timestamp = Math.floor(Date.now() / 1000);

    const redisPosKey = vehicleLiveKey(String(vehicleId));
    const redisGeoKey = vehicleGeoKey();

    try {
      // 1. Hot cache write to Redis (simulating Phase 2 RedisPositionSink)
      await redis.hSet(redisPosKey, {
        vehicle_id: String(vehicleId),
        route_id: String(routeId),
        latitude: String(lat),
        longitude: String(lon),
        speed: String(speed),
        bearing: String(bearing),
        timestamp: String(timestamp),
      });
      await redis.expire(redisPosKey, 45);

      await redis.geoAdd(redisGeoKey, {
        member: String(vehicleId),
        longitude: lon,
        latitude: lat,
      });

      // 2. Durable store write to PostgreSQL (simulating Phase 2 PostgresArchiveSink)
      const insertArchiveQuery = `
        INSERT INTO vehicle_position_archive (
          vehicle_id, route_id, latitude, longitude, bearing, speed, gtfs_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, vehicle_id, route_id, latitude, longitude, speed, gtfs_timestamp;
      `;
      const pgRes = await pool.query<{
        id: string;
        vehicle_id: number;
        route_id: number;
        latitude: number;
        longitude: number;
        speed: number;
        gtfs_timestamp: string;
      }>(insertArchiveQuery, [vehicleId, routeId, lat, lon, bearing, speed, timestamp]);

      // 3. Verify hot cache read
      const hotPos = await redis.hGetAll(redisPosKey);
      assert.equal(hotPos['vehicle_id'], String(vehicleId));
      assert.equal(hotPos['route_id'], String(routeId));
      assert.equal(parseFloat(hotPos['latitude']!), lat);
      assert.equal(parseFloat(hotPos['longitude']!), lon);

      const geoPos = await redis.geoPos(redisGeoKey, String(vehicleId));
      assert.ok(geoPos && geoPos.length > 0 && geoPos[0] !== null, 'Vehicle must be in geospatial index');

      // 4. Verify durable archive read
      assert.equal(pgRes.rows.length, 1);
      const archiveRecord = pgRes.rows[0]!;
      assert.equal(archiveRecord.vehicle_id, vehicleId);
      assert.equal(archiveRecord.route_id, routeId);
      assert.equal(archiveRecord.latitude, lat);
      assert.equal(archiveRecord.longitude, lon);
      assert.equal(archiveRecord.speed, speed);
      assert.equal(Number(archiveRecord.gtfs_timestamp), timestamp);
    } finally {
      // Cleanup Redis keys
      await redis.del(redisPosKey);
      await redis.zRem(redisGeoKey, String(vehicleId));

      // Cleanup PostgreSQL archive record and dummy data (cascade will handle archive if we delete vehicle)
      await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
      await pool.query('DELETE FROM routes WHERE id = $1', [routeId]);
    }
  });

  it('should confirm environment configuration integrity against runtime connection details', async () => {
    const pgConfigRes = await pool.query<{ current_user: string; current_database: string }>(
      'SELECT current_user, current_database()'
    );
    const pgUser = pgConfigRes.rows[0]?.current_user;
    const pgDb = pgConfigRes.rows[0]?.current_database;

    assert.equal(
      pgUser,
      process.env['POSTGRES_USER'] || 'postgres',
      'PostgreSQL user matches environment configuration'
    );
    assert.equal(
      pgDb,
      process.env['DATABASE_NAME'] || 'ecotransit',
      'PostgreSQL database name matches environment configuration'
    );

    // Verify Redis client is connected
    assert.equal(redis.isOpen, true, 'Redis client is currently connected');
    assert.equal(redis.isReady, true, 'Redis client is ready to receive commands');
  });
});
