import { io } from 'socket.io-client';

async function testSocket() {
  console.log('--- Connecting to Socket.IO at http://localhost:4000 ---');
  const socket = io('http://localhost:4000', {
    path: '/events/telemetry',
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });

  let frameCount = 0;

  socket.on('connect', () => {
    console.log(`[OK] Connected to Socket.IO gateway with ID: ${socket.id}`);
  });

  socket.on('telemetry_frame', (frame) => {
    frameCount++;
    console.log(`[OK] Received telemetry_frame #${frameCount}:`);
    console.log(`     frameType: ${frame.frameType}`);
    console.log(`     timestamp: ${frame.timestamp}`);
    console.log(`     vehicles: ${frame.vehicles ? frame.vehicles.length : 0} items`);
  });

  socket.on('connect_error', (err) => {
    console.error('[ERROR] Socket.IO connection error:', err.message);
  });

  // Wait 7 seconds
  await new Promise((resolve) => setTimeout(resolve, 7000));

  console.log(`Disconnecting socket. Total frames received: ${frameCount}`);
  socket.disconnect();
  console.log('[OK] Socket test finished.');
}

testSocket().catch(console.error);
