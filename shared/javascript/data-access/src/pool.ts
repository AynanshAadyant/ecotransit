import pg from 'pg';
const { Pool } = pg;

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

export function createPool(config: DatabaseConfig = {}): pg.Pool {
  return new Pool({
    host: config.host || process.env['POSTGRES_HOST'] || 'localhost',
    port: config.port || parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    user: config.user || process.env['POSTGRES_USER'] || 'postgres',
    password: config.password || process.env['POSTGRES_PASSWORD'] || '',
    database: config.database || process.env['DATABASE_NAME'] || 'ecotransit',
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
  });
}
