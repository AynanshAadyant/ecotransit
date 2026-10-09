const db = require('../config/db');
const redis = require('../config/redis');

class DashboardService {
  /**
   * Admin Dashboard Metrics (Section 11)
   */
  async getAdminDashboardMetrics() {
    // 1. Vehicle counts
    const vehicleCountsRes = await db.query(`
      SELECT 
        COUNT(*)::int AS "totalVehicles",
        COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS "activeVehicles",
        COUNT(CASE WHEN status != 'active' THEN 1 END)::int AS "inactiveVehicles"
      FROM vehicles
    `);
    const vehicleStats = vehicleCountsRes.rows[0] || { totalVehicles: 0, activeVehicles: 0, inactiveVehicles: 0 };

    // 2. Active trips
    const tripsRes = await db.query(`
      SELECT COUNT(*)::int AS "activeTrips"
      FROM trips
      WHERE status = 'active'
    `);
    const activeTrips = tripsRes.rows[0]?.activeTrips || 0;

    // 3. Staff count
    const staffRes = await db.query(`
      SELECT COUNT(*)::int AS "totalStaff"
      FROM users
      WHERE role = 'STAFF' AND status = 'active'
    `);
    const totalStaff = staffRes.rows[0]?.totalStaff || 0;

    // 4. Open Incidents
    const incidentsRes = await db.query(`
      SELECT COUNT(*)::int AS "openIncidents"
      FROM incidents
      WHERE status IN ('reported', 'under_investigation')
    `);
    const openIncidents = incidentsRes.rows[0]?.openIncidents || 0;

    // 5. Offline Devices / Vehicles
    // Check Redis keys or query vehicles
    const vehiclesRes = await db.query('SELECT id, device_id FROM vehicles WHERE status = ' + "'active'");
    let offlineDevicesCount = 0;
    for (const v of vehiclesRes.rows) {
      const status = await redis.get(`vehicle:${v.id}:status`);
      if (status !== 'online') {
        offlineDevicesCount++;
      }
    }

    // 6. Recent incidents
    const recentIncidentsRes = await db.query(`
      SELECT i.id, i.type, i.description, i.severity, i.status, i.created_at AS "createdAt",
             v.vehicle_number AS "vehicleNumber", u.name AS "reportedByName"
      FROM incidents i
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN users u ON u.id = i.reported_by
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    return {
      totalVehicles: vehicleStats.totalVehicles,
      activeVehicles: vehicleStats.activeVehicles,
      inactiveVehicles: vehicleStats.inactiveVehicles,
      activeTrips,
      totalStaff,
      openIncidents,
      offlineDevices: offlineDevicesCount,
      recentIncidents: recentIncidentsRes.rows
    };
  }

  /**
   * Staff Dashboard Metrics (Section 12)
   */
  async getStaffDashboardMetrics(user) {
    const staffId = user.id;

    // 1. Assigned vehicles / trips for this staff
    const assignedVehiclesRes = await db.query(`
      SELECT DISTINCT v.id, v.vehicle_number AS "vehicleNumber", v.registration_number AS "registrationNumber",
             v.status, r.name AS "routeName", r.route_code AS "routeCode"
      FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN routes r ON r.id = t.route_id
      WHERE t.staff_id = $1 AND t.status IN ('scheduled', 'active')
    `, [staffId]);

    // 2. Active Trips
    const activeTripsRes = await db.query(`
      SELECT t.id, t.vehicle_id AS "vehicleId", t.route_id AS "routeId", t.status,
             t.start_time AS "startTime", v.vehicle_number AS "vehicleNumber",
             r.name AS "routeName", r.route_code AS "routeCode"
      FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      JOIN routes r ON r.id = t.route_id
      WHERE t.status = 'active'
      ORDER BY t.start_time DESC
      LIMIT 10
    `);

    // 3. Vehicle Statuses (Aggregated)
    const allVehiclesRes = await db.query(`
      SELECT v.id, v.vehicle_number AS "vehicleNumber", v.status, r.name AS "routeName"
      FROM vehicles v
      LEFT JOIN routes r ON r.id = v.route_id
      ORDER BY v.id ASC
    `);

    const vehicleStatuses = await Promise.all(
      allVehiclesRes.rows.map(async (v) => {
        const liveStatus = await redis.get(`vehicle:${v.id}:status`);
        return {
          id: v.id,
          vehicleNumber: v.vehicleNumber,
          routeName: v.routeName,
          dbStatus: v.status,
          liveStatus: liveStatus || (v.status === 'active' ? 'offline' : v.status)
        };
      })
    );

    // 4. Open Incidents
    const openIncidentsRes = await db.query(`
      SELECT i.id, i.type, i.description, i.severity, i.status, i.created_at AS "createdAt",
             v.vehicle_number AS "vehicleNumber", r.name AS "routeName"
      FROM incidents i
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN routes r ON r.id = i.route_id
      WHERE i.status IN ('reported', 'under_investigation')
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

    // 5. Recent Activity
    const recentActivityRes = await db.query(`
      SELECT 'trip' AS "type", t.id, 'Trip ' || t.status || ' for vehicle ' || v.vehicle_number AS "summary",
             t.updated_at AS "timestamp"
      FROM trips t
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.staff_id = $1 OR t.status = 'active'
      UNION ALL
      SELECT 'incident' AS "type", i.id, 'Incident: ' || i.type || ' reported' AS "summary",
             i.created_at AS "timestamp"
      FROM incidents i
      ORDER BY timestamp DESC
      LIMIT 10
    `, [staffId]);

    return {
      assignedVehicles: assignedVehiclesRes.rows,
      activeTrips: activeTripsRes.rows,
      vehicleStatuses,
      openIncidents: openIncidentsRes.rows,
      recentActivity: recentActivityRes.rows
    };
  }
}

module.exports = new DashboardService();
