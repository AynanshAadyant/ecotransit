const mqtt = require('mqtt');
const gpsService = require('../services/gps.service');

let mqttClient = null;

/**
 * Initialize MQTT Subscriber for ESP32 + NEO-6M GPS ingestion
 */
const initMqttSubscriber = (brokerUrl = null) => {
  const url = brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_GPS_TOPIC || 'ecotransit/vehicles/+/gps';

  console.log(`[MQTT Subscriber] Connecting to broker at ${url}...`);

  const options = {
    clientId: `ecotransit_backend_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
  }

  mqttClient = mqtt.connect(url, options);

  mqttClient.on('connect', () => {
    console.log(`[MQTT Subscriber] Connected to broker successfully.`);
    // Subscribe to wildcard vehicle topic and general GPS topic
    mqttClient.subscribe([topic, 'ecotransit/gps'], (err) => {
      if (err) {
        console.error('[MQTT Subscriber] Failed to subscribe to topics:', err);
      } else {
        console.log(`[MQTT Subscriber] Subscribed to topics: '${topic}', 'ecotransit/gps'`);
      }
    });
  });

  mqttClient.on('message', async (receivedTopic, message) => {
    try {
      const payloadStr = message.toString();
      let payload;
      try {
        payload = JSON.parse(payloadStr);
      } catch (jsonErr) {  
        console.warn(`[MQTT Subscriber] Malformed JSON on topic ${receivedTopic}: ${payloadStr}`);
        return;
      }

      // If vehicleId can be inferred from topic: ecotransit/vehicles/:id/gps
      const topicMatch = receivedTopic.match(/vehicles\/([^/]+)\/gps/);
      if (topicMatch && topicMatch[1] && !payload.vehicleId) {
        payload.vehicleId = parseInt(topicMatch[1], 10);
      }

      await gpsService.processGpsUpdate(payload);
    } catch (err) {
      console.error('[MQTT Subscriber] Error handling incoming GPS message:', err);
    }
  });

  mqttClient.on('error', (err) => {
    console.warn(`[MQTT Subscriber] Connection error: ${err.message}`);
  });

  mqttClient.on('offline', () => {
    console.warn('[MQTT Subscriber] Client went offline.');
  });

  return mqttClient;
};

const getMqttClient = () => mqttClient;

module.exports = {
  initMqttSubscriber,
  getMqttClient
};
