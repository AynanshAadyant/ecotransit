const express = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const staffRoutes = require('./staff.routes');
const db = require('../config/db');
const redis = require('../config/redis');

const router = express.Router();

// Health Check Endpoint
router.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';

  try {
    await db.query('SELECT 1');
  } catch (err) {
    dbStatus = 'degraded: ' + err.message;
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') redisStatus = 'degraded';
  } catch (err) {
    redisStatus = 'degraded: ' + err.message;
  }

  const isMemoryDb = db.isUsingMemoryDb ? db.isUsingMemoryDb() : false;
  const isMemoryRedis = redis.isUsingMemory ? redis.isUsingMemory() : false;

  res.json({
    status: 'ok',
    service: 'Eco-Transit Admin + Staff Backend',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      engine: isMemoryDb ? 'in-memory pg-mem (fallback mode)' : 'PostgreSQL + PostGIS'
    },
    redis: {
      status: redisStatus,
      engine: isMemoryRedis ? 'in-memory key-value store (fallback mode)' : 'Redis Server'
    }
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/staff', staffRoutes);

module.exports = router;
