process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_eco_transit_2026';
process.env.EMBEDDED_MQTT_ENABLED = 'false'; // don't bind port 1883 in unit test

const http = require('http');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');
const { initWebSocket, getIO } = require('../src/websocket');
const gpsService = require('../src/services/gps.service');
const { io: ClientIO } = require('socket.io-client');

let server;
let baseUrl;
let adminToken = '';
let staffToken = '';
let passedTests = 0;
let failedTests = 0;

const assert = (condition, message) => {
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  }
};

const makeRequest = async (endpoint, options = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    method: options.method || 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const runAllTests = async () => {
  console.log('\n============================================================');
  console.log('       ECO-TRANSIT BACKEND AUTOMATED TEST SUITE');
  console.log('============================================================\n');

  try {
    // Setup server
    await db.connectDb();
    server = http.createServer(app);
    initWebSocket(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[Test Server] Started on ${baseUrl}\n`);
        resolve();
      });
    });

    // ------------------------------------------------------------
    // 1. Health Check
    // ------------------------------------------------------------
    console.log('--- TEST GROUP 1: Health & System Diagnostics ---');
    const healthRes = await makeRequest('/api/health');
    assert(healthRes.status === 200, 'Health check returns HTTP 200');
    assert(healthRes.data.status === 'ok', 'System status is OK');
    assert(Boolean(healthRes.data.database), 'Database diagnostic is present');
    assert(Boolean(healthRes.data.redis), 'Redis diagnostic is present');

    // ------------------------------------------------------------
    // 2. Authentication & JWT
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Authentication & Credentials ---');
    
    // Admin login
    const adminLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@ecotransit.org', password: 'AdminPassword@123' }
    });
    assert(adminLogin.status === 200, 'Admin login succeeds with HTTP 200');
    assert(Boolean(adminLogin.data.data?.token), 'Admin login returns JWT token');
    assert(adminLogin.data.data?.user?.role === 'ADMIN', 'Admin role is ADMIN');
    assert(adminLogin.data.data?.user?.password_hash === undefined, 'password_hash is excluded from response');
    adminToken = adminLogin.data.data.token;

    // Staff login
    const staffLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'ramesh.staff@ecotransit.org', password: 'StaffPassword@123' }
    });
    assert(staffLogin.status === 200, 'Staff login succeeds with HTTP 200');
    assert(staffLogin.data.data?.user?.role === 'STAFF', 'Staff role is STAFF');
    staffToken = staffLogin.data.data.token;

    // Bad password
    const badLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@ecotransit.org', password: 'WrongPassword' }
    });
    assert(badLogin.status === 401, 'Bad credentials correctly rejected with HTTP 401');

    // /api/auth/me
    const meRes = await makeRequest('/api/auth/me', { token: adminToken });
    assert(meRes.status === 200, '/api/auth/me returns authenticated user details');
    assert(meRes.data.data?.email === 'admin@ecotransit.org', 'Context email matches token');

    // ------------------------------------------------------------
    // 3. Role-Based Authorization (RBAC)
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: RBAC & Permission Enforcement ---');

    // Unauthenticated request to admin endpoint
    const unauthRes = await makeRequest('/api/admin/staff');
    assert(unauthRes.status === 401, 'Unauthenticated access to /api/admin/staff returns HTTP 401');

    // Staff attempting to access admin-only endpoint
    const forbiddenRes = await makeRequest('/api/admin/staff', { token: staffToken });
    assert(forbiddenRes.status === 403, 'Staff access to /api/admin/staff returns HTTP 403 Forbidden');

    // ------------------------------------------------------------
    // 4. Admin Functionality: Staff Management
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Admin Staff CRUD ---');

    // Create new staff
    const newStaffEmail = `driver_${Date.now()}@ecotransit.org`;
    const createStaffRes = await makeRequest('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Sunil Driver',
        email: newStaffEmail,
        password: 'DriverPassword@123',
        phone: '+919988776655',
        role: 'STAFF',
        status: 'active'
      }
    });
    assert(createStaffRes.status === 201, 'Admin can create staff (HTTP 201)');
    const createdStaffId = createStaffRes.data.data.id;
    assert(createStaffRes.data.data.email === newStaffEmail, 'Created staff has expected email');
    assert(createStaffRes.data.data.password_hash === undefined, 'Staff creation omits passwordHash');

    // Get staff by ID
    const getStaffRes = await makeRequest(`/api/admin/staff/${createdStaffId}`, { token: adminToken });
    assert(getStaffRes.status === 200, 'Admin can fetch staff by ID');
    assert(getStaffRes.data.data.name === 'Sunil Driver', 'Staff name matches');

    // Update staff
    const updateStaffRes = await makeRequest(`/api/admin/staff/${createdStaffId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { phone: '+919900000000', status: 'inactive' }
    });
    assert(updateStaffRes.status === 200, 'Admin can update staff member');
    assert(updateStaffRes.data.data.phone === '+919900000000', 'Updated phone number persisted');
    assert(updateStaffRes.data.data.status === 'inactive', 'Updated status persisted');

    // Delete staff
    const deleteStaffRes = await makeRequest(`/api/admin/staff/${createdStaffId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert(deleteStaffRes.status === 200, 'Admin can delete staff member');

    // ------------------------------------------------------------
    // 5. Admin Functionality: Stops & Routes (with PostGIS)
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Admin Stops & Routes Management ---');

    // Create stop
    const stopCode = `STOP_TEST_${Date.now()}`;
    const createStopRes = await makeRequest('/api/admin/stops', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Kashmere Gate ISBT',
        stopCode,
        latitude: 28.6675,
        longitude: 77.2285,
        address: 'ISBT Kashmere Gate, Delhi',
        status: 'active'
      }
    });
    assert(createStopRes.status === 201, 'Admin can create stop with PostGIS coordinates (HTTP 201)');
    const newStopId = createStopRes.data.data.id;

    // Reject invalid stop coordinates
    const invalidStopRes = await makeRequest('/api/admin/stops', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Invalid Stop',
        stopCode: 'INV-01',
        latitude: 999.0, // invalid
        longitude: 77.0
      }
    });
    assert(invalidStopRes.status === 400, 'Reject stop with invalid geographic coordinates (HTTP 400)');

    // Create route with ordered stops
    const routeCode = `RT_TEST_${Date.now()}`;
    const createRouteRes = await makeRequest('/api/admin/routes', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'ISBT Express Feeder',
        routeCode,
        description: 'Feeder from ISBT to Metro Hub',
        origin: 'Kashmere Gate ISBT',
        destination: 'Connaught Place',
        distanceKm: 9.5,
        stops: [{ stopId: newStopId, stopOrder: 1 }, { stopId: 1, stopOrder: 2 }]
      }
    });
    assert(createRouteRes.status === 201, 'Admin can create route with ordered stops (HTTP 201)');
    const newRouteId = createRouteRes.data.data.id;
    assert(Array.isArray(createRouteRes.data.data.stops), 'Route response contains ordered stops array');

    // ------------------------------------------------------------
    // 6. Admin Functionality: Vehicles Management
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Admin Vehicles CRUD ---');

    const vehNum = `ECO-TEST-${Date.now().toString().slice(-4)}`;
    const regNum = `DL-1PC-${Date.now().toString().slice(-4)}`;
    const devId = `ESP32-TEST-${Date.now().toString().slice(-4)}`;

    const createVehRes = await makeRequest('/api/admin/vehicles', {
      method: 'POST',
      token: adminToken,
      body: {
        vehicleNumber: vehNum,
        registrationNumber: regNum,
        vehicleType: 'Electric Bus',
        capacity: 45,
        routeId: newRouteId,
        deviceId: devId,
        status: 'active'
      }
    });
    assert(createVehRes.status === 201, 'Admin can create vehicle (HTTP 201)');
    const newVehicleId = createVehRes.data.data.id;
    assert(createVehRes.data.data.vehicleNumber === vehNum, 'Vehicle number matches');
    assert(Boolean(createVehRes.data.data.realtime), 'Vehicle response is enriched with real-time status');

    // Update vehicle
    const updateVehRes = await makeRequest(`/api/admin/vehicles/${newVehicleId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'maintenance' }
    });
    assert(updateVehRes.status === 200, 'Admin can update vehicle status');
    assert(updateVehRes.data.data.status === 'maintenance', 'Vehicle status updated to maintenance');

    // Set back to active
    await makeRequest(`/api/admin/vehicles/${newVehicleId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' }
    });

    // ------------------------------------------------------------
    // 7. Staff Operations: Dashboard, Trips & Incidents
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Staff Operations ---');

    // Staff dashboard
    const staffDashRes = await makeRequest('/api/staff/dashboard', { token: staffToken });
    assert(staffDashRes.status === 200, 'Staff can access operational dashboard');
    assert(Array.isArray(staffDashRes.data.data.vehicleStatuses), 'Staff dashboard returns vehicleStatuses');
    assert(Array.isArray(staffDashRes.data.data.activeTrips), 'Staff dashboard returns activeTrips');

    // Staff vehicles
    const staffVehRes = await makeRequest('/api/staff/vehicles', { token: staffToken });
    assert(staffVehRes.status === 200, 'Staff can list vehicles with operational state');

    // Staff create trip
    const createTripRes = await makeRequest('/api/staff/trips', {
      method: 'POST',
      token: staffToken,
      body: {
        vehicleId: newVehicleId,
        routeId: newRouteId,
        status: 'active',
        notes: 'Operational morning shift'
      }
    });
    assert(createTripRes.status === 201, 'Staff can create active trip');
    const newTripId = createTripRes.data.data.id;
    assert(createTripRes.data.data.status === 'active', 'Trip status is active');

    // Staff update trip to completed
    const updateTripRes = await makeRequest(`/api/staff/trips/${newTripId}`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'completed', notes: 'Completed shift safely without delays' }
    });
    assert(updateTripRes.status === 200, 'Staff can update trip status to completed');
    assert(updateTripRes.data.data.status === 'completed', 'Trip marked as completed');

    // Staff report incident
    const reportIncidentRes = await makeRequest('/api/staff/incidents', {
      method: 'POST',
      token: staffToken,
      body: {
        type: 'traffic',
        description: 'Road repair causing single lane bottleneck near ISBT',
        severity: 'medium',
        latitude: 28.6675,
        longitude: 77.2285,
        vehicleId: newVehicleId,
        routeId: newRouteId
      }
    });
    assert(reportIncidentRes.status === 201, 'Staff can report incident with location');
    const newIncidentId = reportIncidentRes.data.data.id;

    // Admin updates incident
    const adminIncidentRes = await makeRequest(`/api/admin/incidents/${newIncidentId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'resolved', adminNotes: 'Traffic cleared by traffic police' }
    });
    assert(adminIncidentRes.status === 200, 'Admin can manage and resolve incident');
    assert(adminIncidentRes.data.data.status === 'resolved', 'Incident status resolved');

    // ------------------------------------------------------------
    // 8. Admin Dashboard Metrics
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Admin Dashboard Statistics ---');
    const adminDashRes = await makeRequest('/api/admin/dashboard', { token: adminToken });
    assert(adminDashRes.status === 200, 'Admin can access system dashboard statistics');
    const stats = adminDashRes.data.data;
    assert(stats.totalVehicles > 0, `Statistics contains totalVehicles (${stats.totalVehicles})`);
    assert(stats.totalStaff >= 0, `Statistics contains totalStaff (${stats.totalStaff})`);
    assert(Array.isArray(stats.recentIncidents), 'Statistics contains recentIncidents array');

    // ------------------------------------------------------------
    // 9. Real-Time GPS Ingestion & Validation (ESP32 IoT)
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 9: Real-Time GPS Ingestion & Redis Cache ---');

    // Test invalid coordinate rejection
    const invalidGps = await gpsService.processGpsUpdate({
      deviceId: devId,
      latitude: 0,
      longitude: 0 // 0,0 fix failure
    });
    assert(invalidGps.success === false, 'GPS ingestion rejects (0,0) fix error');

    // Test valid GPS ingestion
    const validGps = await gpsService.processGpsUpdate({
      deviceId: devId,
      vehicleId: newVehicleId,
      latitude: 28.6328,
      longitude: 77.2197,
      speed: 35.0,
      heading: 180,
      timestamp: new Date().toISOString()
    });
    assert(validGps.success === true, 'GPS ingestion succeeds for valid ESP32 payload');

    // Verify Redis has stored real-time position
    const cachedLocationRaw = await redis.get(`vehicle:${newVehicleId}:location`);
    assert(Boolean(cachedLocationRaw), 'Redis stores latest vehicle location in vehicle:{id}:location');
    const cachedLocation = JSON.parse(cachedLocationRaw);
    assert(cachedLocation.latitude === 28.6328, 'Cached latitude is exact');
    assert(cachedLocation.speed === 35.0, 'Cached speed is exact');

    const cachedStatus = await redis.get(`vehicle:${newVehicleId}:status`);
    assert(cachedStatus === 'online', 'Redis vehicle status updated to online');

    // Verify vehicle endpoint returns cached coordinates
    const vehLiveRes = await makeRequest(`/api/staff/vehicles/${newVehicleId}`, { token: staffToken });
    assert(vehLiveRes.data.data.realtime?.status === 'online', 'Staff vehicle API returns real-time online status');
    assert(vehLiveRes.data.data.realtime?.location?.latitude === 28.6328, 'Staff vehicle API returns real-time GPS coordinates');

    // ------------------------------------------------------------
    // 10. WebSockets Integration (Socket.IO)
    // ------------------------------------------------------------
    console.log('\n--- TEST GROUP 10: WebSocket Real-Time Broadcast ---');
    await new Promise((resolve, reject) => {
      const socket = ClientIO(baseUrl, {
        auth: { token: adminToken },
        transports: ['websocket', 'polling']
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket event timed out'));
      }, 5000);

      socket.on('connect', () => {
        // Trigger a GPS update which should emit 'vehicle:location_updated'
        gpsService.processGpsUpdate({
          deviceId: devId,
          vehicleId: newVehicleId,
          latitude: 28.6340,
          longitude: 77.2210,
          speed: 40.0,
          heading: 185,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('vehicle:location_updated', (data) => {
        if (data.vehicleId === newVehicleId) {
          assert(data.latitude === 28.6340, 'WebSocket received vehicle:location_updated with live coordinates');
          clearTimeout(timer);
          socket.disconnect();
          resolve();
        }
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(err);
      });
    });

    console.log('\n============================================================');
    console.log(`  ALL TESTS PASSED! (${passedTests} passed, ${failedTests} failed)`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n❌ Test Suite encountered an error:', err.message);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failedTests > 0 ? 1 : 0);
  }
};

runAllTests();
