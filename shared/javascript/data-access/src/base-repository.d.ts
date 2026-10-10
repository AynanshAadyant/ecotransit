import type { Pool, PoolClient } from 'pg';
import { AppError } from '@ecotransit/core-utils';
export declare abstract class BaseRepository {
    protected readonly pool: Pool;
    protected constructor(pool: Pool);
    protected query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    protected queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
    protected withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
    protected mapDriverError(cause: unknown): AppError;
    protected recordLatency(_durationMs: number): void;
}
//# sourceMappingURL=base-repository.d.ts.map