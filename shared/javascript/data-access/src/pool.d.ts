import pg from 'pg';
export interface DatabaseConfig {
    host?: string | undefined;
    port?: number | undefined;
    user?: string | undefined;
    password?: string | undefined;
    database?: string | undefined;
    max?: number | undefined;
    idleTimeoutMillis?: number | undefined;
    connectionTimeoutMillis?: number | undefined;
}
export declare function createPool(config?: DatabaseConfig): pg.Pool;
//# sourceMappingURL=pool.d.ts.map