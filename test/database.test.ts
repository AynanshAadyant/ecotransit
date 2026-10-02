import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createPool, BaseRepository } from '@ecotransit/data-access';
import { AppError, ConflictError, ValidationError } from '@ecotransit/core-utils';
import type { Pool, PoolClient } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env from root is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('Phase 0 Infrastructure: PostgreSQL Database Connectivity', () => {
  let pool: Pool;

  before(() => {
    pool = createPool({
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('should load database environment variables correctly', () => {
    assert.ok(process.env['POSTGRES_HOST'], 'POSTGRES_HOST must be defined');
    assert.ok(process.env['POSTGRES_PORT'], 'POSTGRES_PORT must be defined');
    assert.ok(process.env['POSTGRES_USER'], 'POSTGRES_USER must be defined');
    assert.ok(process.env['DATABASE_NAME'], 'DATABASE_NAME must be defined');
    assert.equal(
      parseInt(process.env['POSTGRES_PORT']!, 10),
      5432,
      'POSTGRES_PORT should default to 5432'
    );
  });

  it('should successfully establish pool connection and execute basic handshake', async () => {
    const client = await pool.connect();
    try {
      const res = await client.query<{ alive: number; db_name: string; pg_version: string }>(
        'SELECT 1 AS alive, current_database() AS db_name, version() AS pg_version'
      );
      assert.ok(res.rows.length === 1, 'Query should return 1 row');
      const row = res.rows[0]!;
      assert.equal(row.alive, 1, 'Handshake query should return 1');
      assert.equal(
        row.db_name,
        process.env['DATABASE_NAME'] || 'ecotransit',
        'Connected database must match configured DATABASE_NAME'
      );
      assert.ok(row.pg_version.includes('PostgreSQL'), 'Server version must be PostgreSQL');
    } finally {
      client.release();
    }
  });

  it('should verify PostGIS spatial extension is enabled', async () => {
    const res = await pool.query<{ extname: string; extversion: string }>(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'"
    );
    assert.ok(
      res.rows.length > 0,
      'PostGIS extension must be installed and enabled in the database'
    );
    assert.equal(res.rows[0]?.extname, 'postgis');
  });

  it('should verify schema_migrations table and baseline migration status', async () => {
    const tableCheck = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) AS exists;
    `);
    assert.equal(tableCheck.rows[0]?.exists, true, 'schema_migrations table must exist');

    const migrations = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const versions = migrations.rows.map((r) => r.version);
    assert.ok(
      versions.includes('001_initial_schema.sql'),
      'Migration 001_initial_schema.sql must be applied in schema_migrations'
    );
  });

  it('should verify all core Phase 0 transit and domain tables exist', async () => {
    const expectedTables = [
      'stops',
      'routes',
      'route_stops',
      'route_segments',
      'route_segment_traversal_matrix',
      'route_segment_traversal_matrix_staging',
      'vehicle_position_archive',
      'staff',
      'shift_assignments',
      'incidents',
    ];

    const res = await pool.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = new Set(res.rows.map((r) => r.table_name));

    for (const tableName of expectedTables) {
      assert.ok(
        existingTables.has(tableName),
        `Table '${tableName}' must exist in public schema`
      );
    }
  });

  it('should verify core table columns and schema types match Phase 0 specifications', async () => {
    // Check stops columns
    const stopsColsRes = await pool.query<{ column_name: string }>(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'stops'
    `);
    const stopsCols = new Set(stopsColsRes.rows.map((r) => r.column_name));
    for (const col of ['stop_id', 'stop_name', 'latitude', 'longitude', 'cluster_id']) {
      assert.ok(stopsCols.has(col), `stops table must contain '${col}' column`);
    }

    // Check vehicle_position_archive columns
    const archiveColsRes = await pool.query<{ column_name: string }>(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'vehicle_position_archive'
    `);
    const archiveCols = new Set(archiveColsRes.rows.map((r) => r.column_name));
    for (const col of [
      'vehicle_id',
      'route_id',
      'latitude',
      'longitude',
      'bearing',
      'speed',
      'is_speed_suspect',
      'gtfs_timestamp',
      'recorded_at',
    ]) {
      assert.ok(archiveCols.has(col), `vehicle_position_archive must contain '${col}' column`);
    }
  });

  it('should verify ACID transaction isolation and rollback integrity', async () => {
    const testStopId = 'TEST_STOP_TX_ROLLBACK';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO stops (stop_id, stop_name, latitude, longitude)
         VALUES ($1, $2, $3, $4)`,
        [testStopId, 'Temporary Rollback Test Stop', 28.6139, 77.209]
      );

      // Verify row is visible inside transaction
      const inTx = await client.query('SELECT stop_id FROM stops WHERE stop_id = $1', [testStopId]);
      assert.equal(inTx.rows.length, 1);

      // Roll back transaction
      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Verify row does NOT exist after rollback
    const afterRollback = await pool.query('SELECT stop_id FROM stops WHERE stop_id = $1', [
      testStopId,
    ]);
    assert.equal(
      afterRollback.rows.length,
      0,
      'Rolled-back record must not persist in the database'
    );
  });

  it('should verify BaseRepository subclass operations and driver error mapping', async () => {
    class TestInfraRepository extends BaseRepository {
      constructor(p: Pool) {
        super(p);
      }

      public async ping(): Promise<number> {
        const row = await this.queryOne<{ val: number }>('SELECT 42 AS val');
        return row?.val ?? 0;
      }

      public async insertStop(id: string, name: string, lat: number, lon: number): Promise<void> {
        await this.query(
          'INSERT INTO stops (stop_id, stop_name, latitude, longitude) VALUES ($1, $2, $3, $4)',
          [id, name, lat, lon]
        );
      }

      public async deleteStop(id: string): Promise<void> {
        await this.query('DELETE FROM stops WHERE stop_id = $1', [id]);
      }

      public async runInTx<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
        return this.withTransaction(fn);
      }
    }

    const repo = new TestInfraRepository(pool);
    const pingVal = await repo.ping();
    assert.equal(pingVal, 42, 'BaseRepository queryOne should return query result');

    const testStopId = 'TEST_REPO_STOP_01';
    try {
      await repo.insertStop(testStopId, 'Test Stop For Repo', 28.7041, 77.1025);

      // Trigger unique constraint violation to verify BaseRepository.mapDriverError -> ConflictError
      let errorThrown: unknown = null;
      try {
        await repo.insertStop(testStopId, 'Duplicate Stop', 28.7041, 77.1025);
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown instanceof ConflictError, 'Duplicate key must map to ConflictError');
      assert.equal(
        (errorThrown as ConflictError).statusCode,
        409,
        'ConflictError must have HTTP status 409'
      );
    } finally {
      await repo.deleteStop(testStopId);
    }
  });
});
