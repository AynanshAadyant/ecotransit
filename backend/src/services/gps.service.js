const db = require('../config/db');
const redis = require('../config/redis');
const { validateGpsPayload } = require('../validators/gps.validator');
const { emitVehicleLocation, emitVehicleStatus } = require('../websocket');

// Haversine distance in meters between two lat/lng pairs
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

class GpsService {
  constructor() {
    this.lastWriteCache = new Map(); // vehicleId -> { timestamp, latitude, longitude }
    this.deviceVehicleCache = new Map(); // deviceId -> vehicleId
    this.offlineTtlSeconds = parseInt(process.env.VEHICLE_OFFLINE_TIMEOUT_SEC || '90', 10);
    this.minIntervalSec = parseInt(process.env.GPS_DB_WRITE_INTERVAL_SEC || '15', 10);
    this.minDistanceMeters = parseFloat(process.env.GPS_DB_MIN_DISTANCE_METERS || '50');
  }

  /**
   * Resolve vehicle ID from device ID or vice-versa
   */
  async resolveVehicleId(deviceId, vehicleId) {
    if (vehicleId) {
      return parseInt(vehicleId, 10);
    }

    if (!deviceId) return null;

    if (this.deviceVehicleCache.has(deviceId)) {
      return this.deviceVehicleCache.get(deviceId);
    }

    const res = await db.query('SELECT id FROM vehicles WHERE UPPER(device_id) = UPPER($1) LIMIT 1', [deviceId]);
    if (res.rows.length > 0) {
      const vId = res.rows[0].id;
      this.deviceVehicleCache.set(deviceId, vId);
      return vId;
    }

    return null;
  }

  /**
   * Process raw GPS data from MQTT packet
   * @param {object} rawPayload 
   */
  async processGpsUpdate(rawPayload) {
    // 1. Validate payload
    const { isValid, error, sanitized } = validateGpsPayload(rawPayload);
    if (!isValid) {
      console.warn(`[GPS Ingest] Rejected invalid payload: ${error}`, rawPayload);
      return { success: false, reason: error };
    }

    const { deviceId, latitude, longitude, speed, heading, timestamp } = sanitized;

    // 2. Resolve vehicleId
    const vehicleId = await this.resolveVehicleId(deviceId, sanitized.vehicleId);
    if (!vehicleId) {
      console.warn(`[GPS Ingest] No vehicle registered for device '${deviceId}'`);
      return { success: false, reason: `Unregistered device: ${deviceId}` };
    }

    const locationData = {
      vehicleId,
      deviceId,
      latitude,
      longitude,
      speed,
      heading,
      timestamp,
      updatedAt: new Date().toISOString()
    };

    // 3. Store latest vehicle position in Redis
    try {
      await redis.set(`vehicle:${vehicleId}:location`, JSON.stringify(locationData));
      // Set online status with TTL heartbeat
      await redis.setex(`vehicle:${vehicleId}:status`, this.offlineTtlSeconds, 'online');
      if (deviceId) {
        await redis.setex(`device:${deviceId}:status`, this.offlineTtlSeconds, 'active');
      }
    } catch (err) {
      console.warn('[GPS Ingest] Redis update warning:', err.message);
    }

    // 4. Determine if this point should be persisted to PostgreSQL
    await this._evaluateAndPersistGpsLog(vehicleId, deviceId, latitude, longitude, speed, heading, timestamp);

    // 5. Broadcast real-time location via WebSocket
    emitVehicleLocation({
      ...locationData,
      status: 'online'
    });

    return {
      success: true,
      vehicleId,
      latitude,
      longitude,
      speed
    };
  }

  /**
   * Smart PostgreSQL persistence strategy:
   * Avoids flooding database on every 1s ping. Persists if:
   * 1. Vehicle moved > minDistanceMeters (default 50m)
   * 2. Or elapsed time > minIntervalSec (default 15s)
   * 3. Or it's the first point recorded
   */
  async _evaluateAndPersistGpsLog(vehicleId, deviceId, latitude, longitude, speed, heading, timestamp) {
    const now = Date.now();
    const lastWrite = this.lastWriteCache.get(vehicleId);

    let shouldWrite = false;

    if (!lastWrite) {
      shouldWrite = true;
    } else {
      const elapsedSec = (now - lastWrite.timestamp) / 1000;
      const distance = calculateDistanceMeters(
        lastWrite.latitude,
        lastWrite.longitude,
        latitude,
        longitude
      );

      if (elapsedSec >= this.minIntervalSec || distance >= this.minDistanceMeters) {
        shouldWrite = true;
      }
    }

    if (!shouldWrite) {
      return;
    }

    // Check for active trip associated with this vehicle
    let activeTripId = null;
    try {
      const tripRes = await db.query(
        "SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'active' LIMIT 1",
        [vehicleId]
      );
      if (tripRes.rows.length > 0) {
        activeTripId = tripRes.rows[0].id;
      }
    } catch (err) {  
      // non-fatal
    }

    try {
      const insertSql = `
        INSERT INTO gps_logs (vehicle_id, trip_id, device_id, latitude, longitude, location, speed, heading, recorded_at, created_at)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7, $8, CURRENT_TIMESTAMP)
      `;

      await db.query(insertSql, [
        vehicleId,
        activeTripId,
        deviceId || null,
        latitude,
        longitude,
        speed,
        heading,
        new Date(timestamp).toISOString()
      ]);

      // Update cache
      this.lastWriteCache.set(vehicleId, {
        timestamp: now,
        latitude,
        longitude
      });
    } catch (err) {
      console.error('[GPS Ingest] Failed to persist GPS log in PostgreSQL:', err.message);
    }
  }

  /**
   * Retrieve historical GPS breadcrumbs for a vehicle or trip
   */
  async getVehicleGpsHistory(vehicleId, limit = 100) {
    const queryText = `
      SELECT id, vehicle_id AS "vehicleId", trip_id AS "tripId",
             latitude, longitude, speed, heading, recorded_at AS "recordedAt"
      FROM gps_logs
      WHERE vehicle_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `;
    const res = await db.query(queryText, [vehicleId, limit]);
    return res.rows;
  }
}

module.exports = new GpsService();
