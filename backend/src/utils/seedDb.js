require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { hashPassword } = require('./password');

const seedDatabase = async () => {
  try {
    console.log('[DB Seed] Reading seeds.sql...');
    const seedsPath = path.join(__dirname, '../../database/seeds.sql');
    if (fs.existsSync(seedsPath)) {
      const seedsSql = fs.readFileSync(seedsPath, 'utf8');
      console.log('[DB Seed] Executing seeds.sql...');
      await db.query(seedsSql);
      console.log('[DB Seed] seeds.sql executed successfully.');
    }

    // Ensure configured Admin account from .env exists
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ecotransit.org';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminPassword@123';
    const adminName = process.env.SEED_ADMIN_NAME || 'System Administrator';
    const adminPhone = process.env.SEED_ADMIN_PHONE || '+919876543210';

    const check = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail]);
    if (check.rows.length === 0) {
      console.log(`[DB Seed] Seeding primary admin account: ${adminEmail}`);
      const hashed = await hashPassword(adminPassword);
      await db.query(
        `INSERT INTO users (name, email, password_hash, phone, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [adminName, adminEmail, hashed, adminPhone]
      );
      console.log('[DB Seed] Primary admin created.');
    } else {
      console.log(`[DB Seed] Admin account '${adminEmail}' is already configured.`);
    }

    console.log('[DB Seed] Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[DB Seed] Seeding failed:', err);
    process.exit(1);
  }
};

seedDatabase();
