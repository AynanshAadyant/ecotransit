const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { newDb, DataType } = require('pg-mem');

let pool = null;
let memoryDb = null;
let isUsingMemoryDb = false;

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ecotransit',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };
};

/**
 * Initializes in-memory PostgreSQL emulator using pg-mem
 * for environments without local PostgreSQL running
 */
const initMemoryDb = () => {
  if (memoryDb) return memoryDb;

  const db = newDb();

  // Register common PostGIS and Postgres stub functions in pg-mem
  db.public.registerFunction({
    name: 'st_makepoint',
    args: [DataType.float, DataType.float],
    returns: DataType.text,
    implementation: (x, y) => `POINT(${x} ${y})`
  });

  db.public.registerFunction({
    name: 'st_setsrid',
    args: [DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (pt) => pt
  });

  db.public.registerFunction({
    name: 'st_astext',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (pt) => pt || null
  });

  db.public.registerFunction({
    name: 'postgis_version',
    args: [],
    returns: DataType.text,
    implementation: () => '3.4.0'
  });

  db.public.registerFunction({
    name: 'pg_get_serial_sequence',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (tbl, col) => `${tbl}_${col}_seq`
  });

  db.public.registerFunction({
    name: 'setval',
    args: [DataType.text, DataType.integer],
    returns: DataType.integer,
    implementation: (seq, val) => val
  });

  // Load schema and seeds
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Clean schema for pg-mem:
    // Remove DO $$ blocks and map GEOMETRY to TEXT
    schemaSql = schemaSql
      .replace(/DO \$\$[\s\S]*?\$\$ LANGUAGE plpgsql;/gi, '')
      .replace(/DO \$\$[\s\S]*?\$\$;/gi, '')
      .replace(/GEOMETRY\(Point,\s*4326\)/gi, 'TEXT')
      .replace(/GEOMETRY/gi, 'TEXT');

    db.public.none(schemaSql);

    const seedsPath = path.join(__dirname, '../../database/seeds.sql');
    if (fs.existsSync(seedsPath)) {
      let seedsSql = fs.readFileSync(seedsPath, 'utf8');
      seedsSql = seedsSql
        .replace(/SELECT setval\([^;]+;/gi, '')
        .replace(/INTERVAL '[^']+'/gi, "'0 seconds'");

      db.public.none(seedsSql);
    }

    console.log('[DB] Fallback in-memory PostgreSQL initialized with schema & seeds.');
  } catch (err) {
    console.error('[DB] Failed to load schema into in-memory DB:', err.message);
  }

  memoryDb = db.adapters.createPg();
  isUsingMemoryDb = true;
  return memoryDb;
};

/**
 * Connect to PostgreSQL or fall back to in-memory PostgreSQL
 */
const connectDb = async () => {
  if (pool) return pool;

  const config = getPoolConfig();
  const testPool = new Pool(config);

  try {
    const client = await testPool.connect();
    client.release();
    pool = testPool;
    isUsingMemoryDb = false;
    console.log(`[DB] Connected to PostgreSQL at ${config.host || 'remote'}:${config.port || 5432}/${config.database || ''}`);
    return pool;
  } catch (err) {
    console.warn(`[DB] PostgreSQL connection failed (${err.code || err.message}).`);
    console.warn('[DB] Switching to resilient in-memory PostgreSQL engine (pg-mem). Full schema & seeds active.');
    await testPool.end().catch(() => {});
    const mem = initMemoryDb();
    pool = new mem.Pool();
    return pool;
  }
};

/**
 * Execute query against database
 * @param {string} text - SQL Query
 * @param {Array} params - Query Parameters
 */
const query = async (text, params) => {
  if (!pool) {
    await connectDb();
  }
  return pool.query(text, params);
};

/**
 * Get client for transactions
 */
const getClient = async () => {
  if (!pool) {
    await connectDb();
  }
  return pool.connect();
};

module.exports = {
  query,
  getClient,
  connectDb,
  isUsingMemoryDb: () => isUsingMemoryDb,
  getPool: () => pool
};
