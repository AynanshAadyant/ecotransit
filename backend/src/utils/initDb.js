require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const initDatabase = async () => {
  try {
    console.log('[DB Init] Reading schema.sql...');
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[DB Init] Executing schema on database...');
    await db.query(schemaSql);
    console.log('[DB Init] Schema created successfully!');

    process.exit(0);
  } catch (err) {
    console.error('[DB Init] Error executing schema:', err);
    process.exit(1);
  }
};

initDatabase();
