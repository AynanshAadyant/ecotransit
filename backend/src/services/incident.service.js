const db = require('../config/db');
const { emitIncidentCreated, emitIncidentUpdated } = require('../websocket');

class IncidentService {
  /**
   * List incidents with filters
   */
  async getAllIncidents(filters = {}) {
    let queryText = `
      SELECT i.id, i.type, i.description, i.severity, i.latitude, i.longitude,
             i.vehicle_id AS "vehicleId", i.route_id AS "routeId",
             i.reported_by AS "reportedBy", i.status, i.admin_notes AS "adminNotes",
             i.created_at AS "createdAt", i.updated_at AS "updatedAt",
             u.name AS "reportedByName", u.email AS "reportedByEmail",
             v.vehicle_number AS "vehicleNumber",
             r.name AS "routeName", r.route_code AS "routeCode"
      FROM incidents i
      JOIN users u ON u.id = i.reported_by
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN routes r ON r.id = i.route_id
    `;
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`i.status = $${params.length}`);
    }

    if (filters.severity) {
      params.push(filters.severity.toLowerCase());
      conditions.push(`i.severity = $${params.length}`);
    }

    if (filters.type) {
      params.push(filters.type.toLowerCase());
      conditions.push(`i.type = $${params.length}`);
    }

    if (filters.vehicleId) {
      params.push(parseInt(filters.vehicleId, 10));
      conditions.push(`i.vehicle_id = $${params.length}`);
    }

    if (filters.reportedBy) {
      params.push(parseInt(filters.reportedBy, 10));
      conditions.push(`i.reported_by = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY i.id DESC';

    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Get single incident by ID
   */
  async getIncidentById(id) {
    const queryText = `
      SELECT i.id, i.type, i.description, i.severity, i.latitude, i.longitude,
             i.vehicle_id AS "vehicleId", i.route_id AS "routeId",
             i.reported_by AS "reportedBy", i.status, i.admin_notes AS "adminNotes",
             i.created_at AS "createdAt", i.updated_at AS "updatedAt",
             u.name AS "reportedByName", u.email AS "reportedByEmail", u.phone AS "reportedByPhone",
             v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             r.name AS "routeName", r.route_code AS "routeCode"
      FROM incidents i
      JOIN users u ON u.id = i.reported_by
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN routes r ON r.id = i.route_id
      WHERE i.id = $1
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Incident not found');
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  }

  /**
   * Report an incident (Staff or Admin)
   */
  async createIncident(data, reportedByUser) {
    const { type, description, severity, latitude, longitude, vehicleId, routeId } = data;
    const reportedBy = reportedByUser.id;

    let insertText;
    let params;

    if (latitude !== null && longitude !== null && latitude !== undefined && longitude !== undefined) {
      insertText = `
        INSERT INTO incidents (type, description, severity, latitude, longitude, location, vehicle_id, route_id, reported_by, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7, $8, 'reported', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      params = [type, description, severity || 'medium', latitude, longitude, vehicleId || null, routeId || null, reportedBy];
    } else {
      insertText = `
        INSERT INTO incidents (type, description, severity, vehicle_id, route_id, reported_by, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'reported', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      params = [type, description, severity || 'medium', vehicleId || null, routeId || null, reportedBy];
    }

    const res = await db.query(insertText, params);
    const created = await this.getIncidentById(res.rows[0].id);

    // Broadcast incident created via WebSocket
    emitIncidentCreated(created);

    return created;
  }

  /**
   * Update incident (Admin management: status, admin notes, etc.)
   */
  async updateIncident(id, data) {
    const current = await this.getIncidentById(id);

    const updates = [];
    const params = [id];

    if (data.status !== undefined) {
      params.push(data.status.toLowerCase());
      updates.push(`status = $${params.length}`);
    }

    if (data.adminNotes !== undefined) {
      params.push(data.adminNotes);
      updates.push(`admin_notes = $${params.length}`);
    }

    if (data.severity !== undefined) {
      params.push(data.severity.toLowerCase());
      updates.push(`severity = $${params.length}`);
    }

    if (data.description !== undefined) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateText = `
      UPDATE incidents
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id
    `;

    await db.query(updateText, params);
    const updated = await this.getIncidentById(id);

    // Broadcast incident updated via WebSocket
    emitIncidentUpdated(updated);

    return updated;
  }
}

module.exports = new IncidentService();
