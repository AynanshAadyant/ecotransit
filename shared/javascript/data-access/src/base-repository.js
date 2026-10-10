import { AppError, ConflictError, ValidationError, NotFoundError } from '@ecotransit/core-utils';
export class BaseRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async query(sql, params = []) {
        const started = performance.now();
        try {
            const result = await this.pool.query(sql, params);
            return result.rows;
        }
        catch (cause) {
            throw this.mapDriverError(cause);
        }
        finally {
            this.recordLatency(performance.now() - started);
        }
    }
    async queryOne(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows[0] ?? null;
    }
    async withTransaction(fn) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const out = await fn(client);
            await client.query('COMMIT');
            return out;
        }
        catch (cause) {
            await client.query('ROLLBACK');
            throw this.mapDriverError(cause);
        }
        finally {
            client.release();
        }
    }
    mapDriverError(cause) {
        if (cause instanceof AppError) {
            return cause;
        }
        const pgErr = cause;
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
    recordLatency(_durationMs) {
        // Overridden or wired to metrics recorder
    }
}
//# sourceMappingURL=base-repository.js.map