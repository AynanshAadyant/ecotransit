import type { Pool, PoolClient } from 'pg';
import { AppError, ConflictError, ValidationError, NotFoundError } from '@ecotransit/core-utils';

export abstract class BaseRepository {
  protected constructor(protected readonly pool: Pool) {}

  protected async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const started = performance.now();
    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (cause) {
      throw this.mapDriverError(cause);
    } finally {
      this.recordLatency(performance.now() - started);
    }
  }

  protected async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  protected async withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (cause) {
      await client.query('ROLLBACK');
      throw this.mapDriverError(cause);
    } finally {
      client.release();
    }
  }

  protected mapDriverError(cause: unknown): AppError {
    if (cause instanceof AppError) {
      return cause;
    }

    const pgErr = cause as { code?: string; detail?: string; message?: string };
    if (pgErr.code) {
      switch (pgErr.code) {
        case '23505': // unique_violation
          return new ConflictError(pgErr.detail || 'Unique constraint violation', pgErr);
        case '23503': // foreign_key_violation
          return new ValidationError(pgErr.detail || 'Foreign key reference violation', pgErr);
        case '23502': // not_null_violation
          return new ValidationError(pgErr.message || 'Required field missing', pgErr);
        case 'P0002': // no_data_found
          return new NotFoundError('Record');
        default:
          return new AppError(500, 'database_error', pgErr.message || 'Database error', pgErr);
      }
    }

    const message = cause instanceof Error ? cause.message : 'Unknown database error';
    return new AppError(500, 'database_error', message, cause);
  }

  // Hook for metrics instrumentation
  protected recordLatency(_durationMs: number): void {
    // Overridden or wired to metrics recorder
  }
}
