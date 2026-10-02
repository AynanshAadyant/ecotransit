import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'ecotransit',
};

async function runMigrations() {
  const client = new Client(config);
  console.log(`Connecting to database ${config.database} on ${config.host}:${config.port}...`);

  try {
    await client.connect();
    console.log('Connected to database.');

    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const res = await client.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set(res.rows.map((r) => r.version));

    // Read migrations directory
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found at: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`[SKIP] ${file} (already applied)`);
        continue;
      }

      console.log(`[APPLYING] ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[APPLIED] ${file} successfully.`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[FAILED] Error running migration ${file}:`, err);
        throw err;
      }
    }

    console.log(`\nMigration run completed. ${appliedCount} migration(s) applied.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
