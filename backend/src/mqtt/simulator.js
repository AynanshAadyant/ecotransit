const mqtt = require('mqtt');
require('dotenv').config();

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
console.log(`[GPS Simulator] Connecting to MQTT broker at ${brokerUrl}...`);

const client = mqtt.connect(brokerUrl);

// Waypoints between Connaught Place and Airport T3
const route1Waypoints = [
  { lat: 28.6328, lng: 77.2197, speed: 28, heading: 215 },
  { lat: 28.6180, lng: 77.2050, speed: 38, heading: 220 },
  { lat: 28.6025, lng: 77.1820, speed: 45, heading: 230 },
  { lat: 28.5921, lng: 77.1563, speed: 32, heading: 240 },
  { lat: 28.5750, lng: 77.1380, speed: 52, heading: 245 },
  { lat: 28.5535, lng: 77.1213, speed: 40, heading: 250 },
  { lat: 28.5562, lng: 77.0867, speed: 22, heading: 260 }
];

let step = 0;

client.on('connect', () => {
  console.log('[GPS Simulator] Connected to MQTT broker. Simulating ESP32 NEO-6M GPS updates...');

  setInterval(() => {
    const point = route1Waypoints[step % route1Waypoints.length];
    // Add minor jitter to simulate real GPS sensor readings
    const jitterLat = point.lat + (Math.random() - 0.5) * 0.0005;
    const jitterLng = point.lng + (Math.random() - 0.5) * 0.0005;
    const speed = Math.round(point.speed + (Math.random() - 0.5) * 4);

    const payload = {
      deviceId: 'ESP32-001',
      vehicleId: 1,
      latitude: parseFloat(jitterLat.toFixed(6)),
      longitude: parseFloat(jitterLng.toFixed(6)),
      speed,
      heading: point.heading,
      timestamp: new Date().toISOString()
    };

    const topic = 'ecotransit/vehicles/1/gps';
    client.publish(topic, JSON.stringify(payload));
    console.log(`[GPS Simulator] Published to ${topic}: Lat ${payload.latitude}, Lng ${payload.longitude}, Speed ${payload.speed} km/h`);

    step++;
  }, 3000);
});

client.on('error', (err) => {
  console.error('[GPS Simulator] MQTT error:', err.message);
});
