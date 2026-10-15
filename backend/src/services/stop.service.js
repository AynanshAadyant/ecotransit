const db = require('../config/db');

class StopService {
  /**
   * List all transit stops
   */
  async getAllStops(filters = {}) {
    let queryText = `
      SELECT id, name, stop_code AS "stopCode", latitude, longitude, address, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM stops
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY id ASC';

    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Get single stop by ID
   */
  async getStopById(id) {
    const queryText = `
      SELECT id, name, stop_code AS "stopCode", latitude, longitude, address, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM stops
      WHERE id = $1
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Stop not found');
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  }

  /**
   * Create new stop with PostGIS Point geometry
   */
  async createStop(data) {
    const { name, stopCode, latitude, longitude, address, status } = data;

    const existing = await db.query('SELECT id FROM stops WHERE LOWER(stop_code) = LOWER($1)', [stopCode]);
    if (existing.rows.length > 0) {
      const error = new Error(`Stop with code '${stopCode}' already exists`);
      error.status = 409;
      throw error;
    }

    const insertText = `
      INSERT INTO stops (name, stop_code, latitude, longitude, location, address, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326), $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, stop_code AS "stopCode", latitude, longitude, address, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(insertText, [
      name,
      stopCode,
      latitude,
      longitude,
      address || null,
      status || 'active'
    ]);

    return result.rows[0];
  }

  /**
   * Update stop
   */
  async updateStop(id, data) {
    const current = await this.getStopById(id);

    const updates = [];
    const params = [id];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }

    if (data.stopCode !== undefined && data.stopCode !== current.stopCode) {
      const existing = await db.query('SELECT id FROM stops WHERE LOWER(stop_code) = LOWER($1) AND id != $2', [data.stopCode, id]);
      if (existing.rows.length > 0) {
        const error = new Error(`Stop code '${data.stopCode}' is already in use`);
        error.status = 409;
        throw error;
      }
      params.push(data.stopCode);
      updates.push(`stop_code = $${params.length}`);
    }

    const hasNewLat = data.latitude !== undefined;
    const hasNewLng = data.longitude !== undefined;
    const lat = hasNewLat ? data.latitude : current.latitude;
    const lng = hasNewLng ? data.longitude : current.longitude;

    if (hasNewLat || hasNewLng) {
      params.push(lat);
      const latParam = params.length;
      params.push(lng);
      const lngParam = params.length;

      updates.push(`latitude = $${latParam}`);
      updates.push(`longitude = $${lngParam}`);
      updates.push(`location = ST_SetSRID(ST_MakePoint($${lngParam}, $${latParam}), 4326)`);
    }

    if (data.address !== undefined) {
      params.push(data.address);
      updates.push(`address = $${params.length}`);
    }

    if (data.status !== undefined) {
      params.push(data.status.toLowerCase());
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = `
      UPDATE stops
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, name, stop_code AS "stopCode", latitude, longitude, address, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(updateQuery, params);
    return result.rows[0];
  }

  /**
   * Delete stop
   */
  async deleteStop(id) {
    await this.getStopById(id);

    // Check if stop is linked to route_stops
    const inUse = await db.query('SELECT route_id FROM route_stops WHERE stop_id = $1 LIMIT 1', [id]);
    if (inUse.rows.length > 0) {
      const error = new Error('Cannot delete stop because it is assigned to one or more routes. Remove it from routes first.');
      error.status = 400;
      throw error;
    }

    await db.query('DELETE FROM stops WHERE id = $1', [id]);
    return { id: parseInt(id, 10), message: 'Stop deleted successfully' };
  }
}

module.exports = new StopService();
