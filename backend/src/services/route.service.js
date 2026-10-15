const db = require('../config/db');

class RouteService {
  /**
   * List all routes
   */
  async getAllRoutes(filters = {}) {
    let queryText = `
      SELECT r.id, r.name, r.route_code AS "routeCode", r.description,
             r.origin, r.destination, r.distance_km AS "distanceKm", r.status,
             r.created_at AS "createdAt", r.updated_at AS "updatedAt",
             COUNT(rs.id)::int AS "stopsCount"
      FROM routes r
      LEFT JOIN route_stops rs ON rs.route_id = r.id
    `;

    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`r.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' GROUP BY r.id ORDER BY r.id ASC';

    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Get single route by ID including ordered list of stops
   */
  async getRouteById(id) {
    const routeQuery = `
      SELECT id, name, route_code AS "routeCode", description,
             origin, destination, distance_km AS "distanceKm", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE id = $1
    `;
    const routeRes = await db.query(routeQuery, [id]);
    if (routeRes.rows.length === 0) {
      const error = new Error('Route not found');
      error.status = 404;
      throw error;
    }

    const route = routeRes.rows[0];

    // Fetch ordered stops
    const stopsQuery = `
      SELECT rs.id AS "routeStopId", rs.stop_order AS "stopOrder",
             s.id AS "stopId", s.name AS "stopName", s.stop_code AS "stopCode",
             s.latitude, s.longitude, s.address, s.status AS "stopStatus"
      FROM route_stops rs
      JOIN stops s ON s.id = rs.stop_id
      WHERE rs.route_id = $1
      ORDER BY rs.stop_order ASC
    `;
    const stopsRes = await db.query(stopsQuery, [id]);
    route.stops = stopsRes.rows;

    return route;
  }

  /**
   * Create new transit route
   */
  async createRoute(data) {
    const { name, routeCode, description, origin, destination, distanceKm, stops, status } = data;

    const existing = await db.query('SELECT id FROM routes WHERE LOWER(route_code) = LOWER($1)', [routeCode]);
    if (existing.rows.length > 0) {
      const error = new Error(`Route code '${routeCode}' is already registered`);
      error.status = 409;
      throw error;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const insertRoute = `
        INSERT INTO routes (name, route_code, description, origin, destination, distance_km, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, route_code AS "routeCode", description, origin, destination,
                  distance_km AS "distanceKm", status, created_at AS "createdAt", updated_at AS "updatedAt"
      `;

      const routeRes = await client.query(insertRoute, [
        name,
        routeCode,
        description || null,
        origin || null,
        destination || null,
        distanceKm || 0,
        status || 'active'
      ]);

      const newRoute = routeRes.rows[0];

      // Assign ordered stops if provided
      if (Array.isArray(stops) && stops.length > 0) {
        for (let i = 0; i < stops.length; i++) {
          const item = stops[i];
          const stopId = typeof item === 'object' ? item.stopId : item;
          const stopOrder = typeof item === 'object' && item.stopOrder !== undefined ? item.stopOrder : i + 1;

          await client.query(
            'INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES ($1, $2, $3)',
            [newRoute.id, stopId, stopOrder]
          );
        }
      }

      await client.query('COMMIT');

      return await this.getRouteById(newRoute.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update route
   */
  async updateRoute(id, data) {
    const current = await this.getRouteById(id);

    const updates = [];
    const params = [id];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }

    if (data.routeCode !== undefined && data.routeCode !== current.routeCode) {
      const existing = await db.query('SELECT id FROM routes WHERE LOWER(route_code) = LOWER($1) AND id != $2', [data.routeCode, id]);
      if (existing.rows.length > 0) {
        const error = new Error(`Route code '${data.routeCode}' is already in use`);
        error.status = 409;
        throw error;
      }
      params.push(data.routeCode);
      updates.push(`route_code = $${params.length}`);
    }

    if (data.description !== undefined) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }

    if (data.origin !== undefined) {
      params.push(data.origin);
      updates.push(`origin = $${params.length}`);
    }

    if (data.destination !== undefined) {
      params.push(data.destination);
      updates.push(`destination = $${params.length}`);
    }

    if (data.distanceKm !== undefined) {
      params.push(data.distanceKm);
      updates.push(`distance_km = $${params.length}`);
    }

    if (data.status !== undefined) {
      params.push(data.status.toLowerCase());
      updates.push(`status = $${params.length}`);
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        const updateText = `UPDATE routes SET ${updates.join(', ')} WHERE id = $1`;
        await client.query(updateText, params);
      }

      // If stops are updated
      if (Array.isArray(data.stops)) {
        await client.query('DELETE FROM route_stops WHERE route_id = $1', [id]);
        for (let i = 0; i < data.stops.length; i++) {
          const item = data.stops[i];
          const stopId = typeof item === 'object' ? item.stopId : item;
          const stopOrder = typeof item === 'object' && item.stopOrder !== undefined ? item.stopOrder : i + 1;
          await client.query(
            'INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES ($1, $2, $3)',
            [id, stopId, stopOrder]
          );
        }
      }

      await client.query('COMMIT');
      return await this.getRouteById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Delete route
   */
  async deleteRoute(id) {
    await this.getRouteById(id);
    await db.query('DELETE FROM routes WHERE id = $1', [id]);
    return { id: parseInt(id, 10), message: 'Route deleted successfully' };
  }

  /**
   * Assign or replace ordered stops for a route
   */
  async setRouteStops(routeId, stopsArray) {
    await this.getRouteById(routeId);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM route_stops WHERE route_id = $1', [routeId]);

      for (let i = 0; i < stopsArray.length; i++) {
        const item = stopsArray[i];
        const stopId = typeof item === 'object' ? item.stopId : item;
        const stopOrder = typeof item === 'object' && item.stopOrder !== undefined ? item.stopOrder : i + 1;
        await client.query(
          'INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES ($1, $2, $3)',
          [routeId, stopId, stopOrder]
        );
      }

      await client.query('COMMIT');
      return await this.getRouteById(routeId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new RouteService();
