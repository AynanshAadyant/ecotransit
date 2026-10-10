const db = require('../config/db');
const redis = require('../config/redis');
const { emitVehicleStatus } = require('../websocket');

class VehicleService {
  /**
   * Enrich vehicle object with latest real-time Redis cache
   */
  async _enrichWithRealtimeData(vehicle) {
    if (!vehicle) return null;
    const vehicleId = vehicle.id;

    try {
      const locationRaw = await redis.get(`vehicle:${vehicleId}:location`);
      const statusRaw = await redis.get(`vehicle:${vehicleId}:status`);

      const liveLocation = locationRaw ? JSON.parse(locationRaw) : null;
      const liveStatus = statusRaw || (vehicle.status === 'active' ? 'offline' : vehicle.status);

      return {
        ...vehicle,
        realtime: {
          status: liveStatus, // 'online' or 'offline'
          location: liveLocation
            ? {
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude,
                speed: liveLocation.speed,
                heading: liveLocation.heading,
                updatedAt: liveLocation.timestamp || liveLocation.updatedAt
              }
            : null
        }
      };
    } catch (err) {  
      return {
        ...vehicle,
        realtime: {
          status: vehicle.status === 'active' ? 'offline' : vehicle.status,
          location: null
        }
      };
    }
  }

  /**
   * List all vehicles with optional filters
   */
  async getAllVehicles(filters = {}) {
    let queryText = `
      SELECT v.id, v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             v.vehicle_type AS "vehicleType", v.capacity, v.route_id AS "routeId",
             v.device_id AS "deviceId", v.status, v.created_at AS "createdAt", v.updated_at AS "updatedAt",
             r.name AS "routeName", r.route_code AS "routeCode"
      FROM vehicles v
      LEFT JOIN routes r ON r.id = v.route_id
    `;
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`v.status = $${params.length}`);
    }

    if (filters.routeId) {
      params.push(parseInt(filters.routeId, 10));
      conditions.push(`v.route_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY v.id ASC';

    const result = await db.query(queryText, params);
    const enriched = await Promise.all(result.rows.map(v => this._enrichWithRealtimeData(v)));
    return enriched;
  }

  /**
   * Get single vehicle by ID
   */
  async getVehicleById(id) {
    const queryText = `
      SELECT v.id, v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             v.vehicle_type AS "vehicleType", v.capacity, v.route_id AS "routeId",
             v.device_id AS "deviceId", v.status, v.created_at AS "createdAt", v.updated_at AS "updatedAt",
             r.name AS "routeName", r.route_code AS "routeCode", r.origin AS "routeOrigin", r.destination AS "routeDestination"
      FROM vehicles v
      LEFT JOIN routes r ON r.id = v.route_id
      WHERE v.id = $1
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      throw error;
    }

    const vehicle = result.rows[0];

    // If vehicle has active trip, include trip information
    const tripRes = await db.query(
      `SELECT t.id AS "activeTripId", t.status AS "tripStatus", t.start_time AS "tripStartTime",
              u.name AS "driverName"
       FROM trips t
       LEFT JOIN users u ON u.id = t.staff_id
       WHERE t.vehicle_id = $1 AND t.status = 'active'
       LIMIT 1`,
      [id]
    );

    vehicle.activeTrip = tripRes.rows[0] || null;

    return await this._enrichWithRealtimeData(vehicle);
  }

  /**
   * Create vehicle
   */
  async createVehicle(data) {
    const { vehicleNumber, registrationNumber, vehicleType, capacity, routeId, deviceId, status } = data;

    // Check uniqueness
    const existing = await db.query(
      'SELECT id FROM vehicles WHERE UPPER(vehicle_number) = UPPER($1) OR UPPER(registration_number) = UPPER($2)',
      [vehicleNumber, registrationNumber]
    );
    if (existing.rows.length > 0) {
      const error = new Error('A vehicle with this number or registration already exists');
      error.status = 409;
      throw error;
    }

    // Verify route exists if provided
    if (routeId) {
      const routeCheck = await db.query('SELECT id FROM routes WHERE id = $1', [routeId]);
      if (routeCheck.rows.length === 0) {
        const error = new Error(`Route with id ${routeId} does not exist`);
        error.status = 400;
        throw error;
      }
    }

    const insertText = `
      INSERT INTO vehicles (vehicle_number, registration_number, vehicle_type, capacity, route_id, device_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, vehicle_number AS "vehicleNumber", registration_number AS "registrationNumber",
                vehicle_type AS "vehicleType", capacity, route_id AS "routeId",
                device_id AS "deviceId", status, created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(insertText, [
      vehicleNumber,
      registrationNumber,
      vehicleType || 'Electric Bus',
      capacity || 40,
      routeId || null,
      deviceId || null,
      status || 'active'
    ]);

    const created = result.rows[0];

    // Maintain device table mapping
    if (deviceId) {
      await db.query(
        `INSERT INTO devices (device_id, vehicle_id, status, updated_at)
         VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT (device_id) DO UPDATE SET vehicle_id = $2, status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [deviceId, created.id]
      );
    }

    return await this._enrichWithRealtimeData(created);
  }

  /**
   * Update vehicle
   */
  async updateVehicle(id, data) {
    const current = await this.getVehicleById(id);

    const updates = [];
    const params = [id];

    if (data.vehicleNumber !== undefined && data.vehicleNumber !== current.vehicleNumber) {
      const check = await db.query('SELECT id FROM vehicles WHERE UPPER(vehicle_number) = UPPER($1) AND id != $2', [data.vehicleNumber, id]);
      if (check.rows.length > 0) {
        const error = new Error('Vehicle number already in use');
        error.status = 409;
        throw error;
      }
      params.push(data.vehicleNumber);
      updates.push(`vehicle_number = $${params.length}`);
    }

    if (data.registrationNumber !== undefined && data.registrationNumber !== current.registrationNumber) {
      const check = await db.query('SELECT id FROM vehicles WHERE UPPER(registration_number) = UPPER($1) AND id != $2', [data.registrationNumber, id]);
      if (check.rows.length > 0) {
        const error = new Error('Registration number already in use');
        error.status = 409;
        throw error;
      }
      params.push(data.registrationNumber);
      updates.push(`registration_number = $${params.length}`);
    }

    if (data.vehicleType !== undefined) {
      params.push(data.vehicleType);
      updates.push(`vehicle_type = $${params.length}`);
    }

    if (data.capacity !== undefined) {
      params.push(data.capacity);
      updates.push(`capacity = $${params.length}`);
    }

    if (data.routeId !== undefined) {
      if (data.routeId) {
        const routeCheck = await db.query('SELECT id FROM routes WHERE id = $1', [data.routeId]);
        if (routeCheck.rows.length === 0) {
          const error = new Error(`Route with id ${data.routeId} does not exist`);
          error.status = 400;
          throw error;
        }
      }
      params.push(data.routeId);
      updates.push(`route_id = $${params.length}`);
    }

    if (data.deviceId !== undefined) {
      params.push(data.deviceId);
      updates.push(`device_id = $${params.length}`);

      if (data.deviceId) {
        await db.query(
          `INSERT INTO devices (device_id, vehicle_id, status, updated_at)
           VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
           ON CONFLICT (device_id) DO UPDATE SET vehicle_id = $2, status = 'active', updated_at = CURRENT_TIMESTAMP`,
          [data.deviceId, id]
        );
      }
    }

    if (data.status !== undefined) {
      params.push(data.status.toLowerCase());
      updates.push(`status = $${params.length}`);

      // Emit status change event
      emitVehicleStatus(id, data.status.toLowerCase());
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = `
      UPDATE vehicles
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, vehicle_number AS "vehicleNumber", registration_number AS "registrationNumber",
                vehicle_type AS "vehicleType", capacity, route_id AS "routeId",
                device_id AS "deviceId", status, created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(updateQuery, params);
    return await this.getVehicleById(result.rows[0].id);
  }

  /**
   * Delete vehicle
   */
  async deleteVehicle(id) {
    await this.getVehicleById(id);
    await db.query('DELETE FROM vehicles WHERE id = $1', [id]);
    await redis.del(`vehicle:${id}:location`, `vehicle:${id}:status`);
    return { id: parseInt(id, 10), message: 'Vehicle deleted successfully' };
  }

  /**
   * Staff view of operational vehicles
   */
  async getStaffVehicles() {
    return this.getAllVehicles();
  }
}

module.exports = new VehicleService();
