import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  createRedisClient,
  vehicleLiveKey,
  vehicleGeoKey,
  routeLiveKey,
  staffSessionKey,
  staticRouteCacheKey,
  staticStopCacheKey,
  routeSegmentsCacheKey,
} from '@ecotransit/data-access';
import type { RedisClientType } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env from root is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('Phase 0 Infrastructure: Redis Cache Connectivity', () => {
  let client: RedisClientType;

  before(async () => {
    client = createRedisClient();
    await client.connect();
  });

  after(async () => {
    if (client && client.isOpen) {
      await client.quit();
    }
  });

  it('should load Redis environment variables correctly', () => {
    assert.ok(process.env['REDIS_HOST'], 'REDIS_HOST must be defined');
    assert.ok(process.env['REDIS_PORT'], 'REDIS_PORT must be defined');
    assert.equal(
      parseInt(process.env['REDIS_PORT']!, 10),
      6379,
      'REDIS_PORT should default to 6379'
    );
  });

  it('should successfully ping Redis server and receive PONG', async () => {
    const pong = await client.ping();
    assert.equal(pong, 'PONG', 'Redis ping should respond with PONG');
  });

  it('should strictly follow shared key builder specifications', () => {
    assert.equal(
      vehicleLiveKey('DL1PC9999'),
      'live:pos:DL1PC9999',
      'vehicleLiveKey format must be live:pos:<id>'
    );
    assert.equal(vehicleGeoKey(), 'live:geo:vehicles', 'vehicleGeoKey must be live:geo:vehicles');
    assert.equal(routeLiveKey('419'), 'live:route:419', 'routeLiveKey must be live:route:<id>');
    assert.equal(
      staffSessionKey('sess_123'),
      'staff:session:sess_123',
      'staffSessionKey must be staff:session:<id>'
    );
    assert.equal(
      staticRouteCacheKey('419'),
      'cache:route:419',
      'staticRouteCacheKey must be cache:route:<id>'
    );
    assert.equal(
      staticStopCacheKey('stop_5'),
      'cache:stop:stop_5',
      'staticStopCacheKey must be cache:stop:<id>'
    );
    assert.equal(
      routeSegmentsCacheKey('419'),
      'cache:segments:419',
      'routeSegmentsCacheKey must be cache:segments:<id>'
    );
  });

  it('should perform string key-value operations with TTL expiration', async () => {
    const testKey = 'test:infra:string_ttl';
    const testVal = 'ecotransit_phase0_ok';

    try {
      // SET with 15 seconds TTL (EX)
      await client.set(testKey, testVal, { EX: 15 });

      const retrieved = await client.get(testKey);
      assert.equal(retrieved, testVal, 'Stored value must match retrieved value');

      const ttl = await client.ttl(testKey);
      assert.ok(ttl > 0 && ttl <= 15, `TTL should be between 1 and 15 seconds, got: ${ttl}`);
    } finally {
      await client.del(testKey);
      const afterDel = await client.get(testKey);
      assert.equal(afterDel, null, 'Deleted key must return null');
    }
  });

  it('should store and retrieve vehicle position telemetry hashes', async () => {
    const vehicleId = 'TEST_BUS_DL1PC7777';
    const key = vehicleLiveKey(vehicleId);

    const telemetryData = {
      vehicle_id: vehicleId,
      route_id: '419',
      latitude: '28.6139',
      longitude: '77.2090',
      speed: '12.5',
      bearing: '180.0',
      timestamp: String(Math.floor(Date.now() / 1000)),
    };

    try {
      await client.hSet(key, telemetryData);
      await client.expire(key, 45); // 45 seconds TTL per Phase 2 spec

      const retrieved = await client.hGetAll(key);
      assert.equal(retrieved['vehicle_id'], telemetryData.vehicle_id);
      assert.equal(retrieved['route_id'], telemetryData.route_id);
      assert.equal(retrieved['latitude'], telemetryData.latitude);
      assert.equal(retrieved['longitude'], telemetryData.longitude);
      assert.equal(retrieved['speed'], telemetryData.speed);

      const ttl = await client.ttl(key);
      assert.ok(ttl > 0 && ttl <= 45, 'Hash key must have active TTL');
    } finally {
      await client.del(key);
    }
  });

  it('should perform geospatial indexing operations for live Delhi fleet tracking', async () => {
    const geoKey = 'test:infra:live_geo_vehicles';

    try {
      // Kashmere Gate ISBT coordinates: 28.6669° N, 77.2289° E
      // Connaught Place coordinates: 28.6315° N, 77.2167° E
      await client.geoAdd(geoKey, [
        {
          longitude: 77.2289,
          latitude: 28.6669,
          member: 'VEHICLE_KASHMERE_GATE',
        },
        {
          longitude: 77.2167,
          latitude: 28.6315,
          member: 'VEHICLE_CONNAUGHT_PLACE',
        },
      ]);

      // Calculate distance between Kashmere Gate and Connaught Place (approx 4.1 km)
      const distMeters = await client.geoDist(
        geoKey,
        'VEHICLE_KASHMERE_GATE',
        'VEHICLE_CONNAUGHT_PLACE',
        'm'
      );
      assert.ok(distMeters !== null, 'Distance between points should be calculated');
      assert.ok(
        distMeters > 3500 && distMeters < 4600,
        `Distance between Kashmere Gate and CP should be ~4.1 km, got ${distMeters} m`
      );

      // Search radius within 2.5 km of Connaught Place
      const nearbyCP = await client.geoSearch(
        geoKey,
        { longitude: 77.2167, latitude: 28.6315 },
        { radius: 2500, unit: 'm' }
      );
      assert.ok(nearbyCP.includes('VEHICLE_CONNAUGHT_PLACE'), 'CP vehicle must be within 2.5km of CP');
      assert.ok(
        !nearbyCP.includes('VEHICLE_KASHMERE_GATE'),
        'Kashmere Gate vehicle must NOT be within 2.5km of CP'
      );

      // Search radius within 10 km should include both
      const within10Km = await client.geoSearch(
        geoKey,
        { longitude: 77.2167, latitude: 28.6315 },
        { radius: 10, unit: 'km' }
      );
      assert.equal(within10Km.length, 2, 'Both vehicles should be within 10 km');
    } finally {
      await client.del(geoKey);
    }
  });

  it('should manage live route vehicle memberships using set operations', async () => {
    const routeKey = routeLiveKey('TEST_ROUTE_502');
    const bus1 = 'DL1PC1001';
    const bus2 = 'DL1PC1002';

    try {
      await client.sAdd(routeKey, [bus1, bus2]);

      const members = await client.sMembers(routeKey);
      assert.equal(members.length, 2);
      assert.ok(members.includes(bus1));
      assert.ok(members.includes(bus2));

      // Remove 1 vehicle
      await client.sRem(routeKey, bus1);
      const remaining = await client.sMembers(routeKey);
      assert.equal(remaining.length, 1);
      assert.ok(remaining.includes(bus2));
    } finally {
      await client.del(routeKey);
    }
  });

  it('should execute atomic transactional batch pipelines', async () => {
    const keyA = 'test:infra:pipeline:a';
    const keyB = 'test:infra:pipeline:b';

    try {
      const multi = client.multi();
      multi.set(keyA, 'val_a');
      multi.set(keyB, 'val_b');
      multi.get(keyA);
      multi.get(keyB);

      const results = await multi.exec();
      assert.equal(results.length, 4);
      assert.equal(results[2], 'val_a');
      assert.equal(results[3], 'val_b');
    } finally {
      await client.del([keyA, keyB]);
    }
  });
});
