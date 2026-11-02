const db = require('../config/db');
const { emitTripStarted, emitTripCompleted } = require('../websocket');

class TripService {
  /**
   * List trips with filtering
   */
  async getAllTrips(filters = {}) {
    let queryText = `
      SELECT t.id, t.vehicle_id AS "vehicleId", t.route_id AS "routeId",
             t.staff_id AS "staffId", t.status, t.start_time AS "startTime",
             t.end_time AS "endTime", t.notes, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
             v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             r.name AS "routeName", r.route_code AS "routeCode",
             u.name AS "driverName", u.email AS "driverEmail"
      FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN routes r ON r.id = t.route_id
      JOIN users u ON u.id = t.staff_id
    `;
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`t.status = $${params.length}`);
    }

    if (filters.staffId) {
      params.push(parseInt(filters.staffId, 10));
      conditions.push(`t.staff_id = $${params.length}`);
    }

    if (filters.vehicleId) {
      params.push(parseInt(filters.vehicleId, 10));
      conditions.push(`t.vehicle_id = $${params.length}`);
    }

    if (filters.routeId) {
      params.push(parseInt(filters.routeId, 10));
      conditions.push(`t.route_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY t.id DESC';

    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Get single trip by ID
   */
  async getTripById(id) {
    const queryText = `
      SELECT t.id, t.vehicle_id AS "vehicleId", t.route_id AS "routeId",
             t.staff_id AS "staffId", t.status, t.start_time AS "startTime",
             t.end_time AS "endTime", t.notes, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
             v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             r.name AS "routeName", r.route_code AS "routeCode", r.origin AS "routeOrigin", r.destination AS "routeDestination",
             u.name AS "driverName", u.email AS "driverEmail", u.phone AS "driverPhone"
      FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN routes r ON r.id = t.route_id
      JOIN users u ON u.id = t.staff_id
      WHERE t.id = $1
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Trip not found');
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  }

  /**
   * Create trip
   */
  async createTrip(data, user) {
    const { vehicleId, routeId, status, startTime, notes } = data;
    // Staff can only create trips assigned to themselves; Admin can assign to any staff
    const staffId = (user && user.role === 'STAFF') ? user.id : (data.staffId || user?.id);

    // Verify vehicle exists
    const vehicleRes = await db.query('SELECT id, status FROM vehicles WHERE id = $1', [vehicleId]);
    if (vehicleRes.rows.length === 0) {
      const error = new Error(`Vehicle with ID ${vehicleId} not found`);
      error.status = 400;
      throw error;
    }

    // Verify route exists
    const routeRes = await db.query('SELECT id FROM routes WHERE id = $1', [routeId]);
    if (routeRes.rows.length === 0) {
      const error = new Error(`Route with ID ${routeId} not found`);
      error.status = 400;
      throw error;
    }

    const tripStatus = (status || 'scheduled').toLowerCase();

    // Check if vehicle already has an active trip if creating an active trip
    if (tripStatus === 'active') {
      const activeCheck = await db.query("SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'active'", [vehicleId]);
      if (activeCheck.rows.length > 0) {
        const error = new Error(`Vehicle ${vehicleId} is already on an active trip (Trip ID: ${activeCheck.rows[0].id})`);
        error.status = 400;
        throw error;
      }
    }

    const insertText = `
      INSERT INTO trips (vehicle_id, route_id, staff_id, status, start_time, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const res = await db.query(insertText, [
      vehicleId,
      routeId,
      staffId,
      tripStatus,
      startTime || new Date().toISOString(),
      notes || null
    ]);

    const created = await this.getTripById(res.rows[0].id);

    if (tripStatus === 'active') {
      emitTripStarted(created);
    }

    return created;
  }

  /**
   * Update trip status / details
   */
  async updateTrip(id, data, user) {
    const current = await this.getTripById(id);

    // If user is STAFF, they can only update trips assigned to them (ADMIN can update any trip)
    if (user.role === 'STAFF' && current.staffId !== user.id) {
      const error = new Error('Forbidden: You can only update trips assigned to yourself.');
      error.status = 403;
      throw error;
    }

    const updates = [];
    const params = [id];

    if (data.status !== undefined) {
      const newStatus = data.status.toLowerCase();

      // State transition validation (prevent invalid lifecycle transitions)
      if (current.status === 'completed') {
        const error = new Error('Invalid state transition: A completed trip cannot be modified or re-activated.');
        error.status = 400;
        throw error;
      }

      if (current.status === 'cancelled') {
        const error = new Error('Invalid state transition: A cancelled trip cannot be re-activated.');
        error.status = 400;
        throw error;
      }

      if (current.status === 'active' && newStatus === 'scheduled') {
        const error = new Error('Invalid state transition: An active trip cannot be reverted back to scheduled.');
        error.status = 400;
        throw error;
      }

      if (newStatus === 'active' && current.status !== 'active') {
        // Ensure vehicle doesn't have another active trip
        const activeCheck = await db.query("SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'active' AND id != $2", [current.vehicleId, id]);
        if (activeCheck.rows.length > 0) {
          const error = new Error(`Vehicle ${current.vehicleId} already has an active trip`);
          error.status = 400;
          throw error;
        }
      }

      params.push(newStatus);
      updates.push(`status = $${params.length}`);

      if (newStatus === 'completed' || newStatus === 'cancelled') {
        const endTime = data.endTime || new Date().toISOString();
        params.push(endTime);
        updates.push(`end_time = $${params.length}`);
      }
    }

    if (data.notes !== undefined) {
      params.push(data.notes);
      updates.push(`notes = $${params.length}`);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateText = `
      UPDATE trips
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id
    `;

    await db.query(updateText, params);
    const updated = await this.getTripById(id);

    if (data.status === 'active' && current.status !== 'active') {
      emitTripStarted(updated);
    } else if (data.status === 'completed' && current.status !== 'completed') {
      emitTripCompleted(updated);
    }

    return updated;
  }
}

module.exports = new TripService();
