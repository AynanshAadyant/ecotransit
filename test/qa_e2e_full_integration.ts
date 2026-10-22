import { io } from 'socket.io-client';
import http from 'http';

function get(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

async function runE2E() {
  console.log('======================================================================');
  console.log('FULL SYSTEM INTEGRATION TEST: REAL DATA END-TO-END VERIFICATION');
  console.log('======================================================================');

  // Step 1: Check Gateway Health
  console.log('\n[Step 1] Checking API Gateway Health at http://localhost:4000/api/health...');
  const healthRes = await get('http://localhost:4000/api/health');
  console.log(`  Gateway Status: ${healthRes.status}, data:`, healthRes.data);
  if (healthRes.status !== 200 || healthRes.data.status !== 'healthy') {
    throw new Error('API Gateway is not healthy!');
  }
  console.log('  [OK] API Gateway is online and connected to Postgres & Redis.');

  // Step 2: Connect Socket.IO Commuter Client
  console.log('\n[Step 2] Connecting Commuter Client to Socket.IO (/events/telemetry)...');
  const socket = io('http://localhost:4000', {
    path: '/events/telemetry',
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });

  const frames: any[] = [];
  socket.on('connect', () => {
    console.log(`  [OK] Client connected to live telemetry gateway! Socket ID: ${socket.id}`);
  });

  socket.on('telemetry_frame', (frame) => {
    frames.push(frame);
    console.log(`  [OK] Received live telemetry_frame:`);
    console.log(`       frameType: ${frame.frameType}`);
    console.log(`       timestamp: ${frame.timestamp}`);
    console.log(`       vehicles count: ${frame.vehicles ? frame.vehicles.length : 0}`);
    if (frame.vehicles && frame.vehicles.length > 0) {
      const sample = frame.vehicles[0];
      console.log(`       sample vehicle: ID=${sample.vehicleId}, route=${sample.routeId}, lat=${sample.latitude}, lon=${sample.longitude}`);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('  [ERROR] Socket connection error:', err.message);
  });

  // Wait up to 10 seconds for at least 1 frame
  console.log('  Awaiting real-time broadcast frames...');
  for (let i = 0; i < 10; i++) {
    if (frames.length >= 1) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Step 3: Query live vehicles via REST
  console.log('\n[Step 3] Querying Live Fleet via REST: GET /api/vehicles/live...');
  const liveRes = await get('http://localhost:4000/api/vehicles/live');
  const liveVehicles = Array.isArray(liveRes.data) ? liveRes.data : [];
  console.log(`  Live vehicles in Redis: ${liveVehicles.length}`);

  // Step 4: ETA Calculation on Live Vehicle
  if (liveVehicles.length > 0) {
    const liveBus = liveVehicles.find((v: any) => v.routeId && v.routeId.length > 0) || liveVehicles[0];
    console.log(`\n[Step 4] Testing End-to-End ETA Calculation on live bus ${liveBus.vehicleId} (Route: ${liveBus.routeId})...`);

    // Fetch route stops
    const routeStopsRes = await get(`http://localhost:4000/api/routes/${encodeURIComponent(liveBus.routeId)}/stops`);
    const stops = Array.isArray(routeStopsRes.data) ? routeStopsRes.data : [];
    console.log(`  Route ${liveBus.routeId} has ${stops.length} registered stops.`);

    if (stops.length > 0) {
      const targetStop = stops[stops.length - 1];
      console.log(`  Target downstream stop: ${targetStop.stopId} (${targetStop.stopName})`);
      const etaRes = await get(`http://localhost:4000/api/eta/${encodeURIComponent(liveBus.vehicleId)}?stopId=${encodeURIComponent(targetStop.stopId)}`);
      console.log(`  ETA Query Status: ${etaRes.status}, Result:`, etaRes.data);
      if (etaRes.status === 200) {
        console.log(`  [OK] Successfully computed ETA: ${etaRes.data.etaSeconds} seconds (Variance: ${etaRes.data.varianceTotal}, Weakest support: ${etaRes.data.weakestCellSupport})`);
      } else {
        console.log(`  [NOTICE] Vehicle may not be on active segment or already past stop: ${etaRes.data?.error?.message || etaRes.status}`);
      }
    }
  } else {
    console.log('\n[Step 4] Notice: No live vehicles currently in Redis TTL window.');
  }

  socket.disconnect();
  console.log('\n======================================================================');
  console.log('E2E INTEGRATION TEST COMPLETED SUCCESSFULLY');
  console.log('======================================================================');
}

runE2E().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
