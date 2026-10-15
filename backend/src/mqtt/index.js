const { startEmbeddedBroker } = require('./broker');
const { initMqttSubscriber, getMqttClient } = require('./subscriber');

/**
 * Initialize MQTT system (Broker + Subscriber)
 */
const initMqtt = async () => {
  const embeddedEnabled = process.env.EMBEDDED_MQTT_ENABLED !== 'false';
  const port = parseInt(process.env.EMBEDDED_MQTT_PORT || '1883', 10);

  if (embeddedEnabled) {
    await startEmbeddedBroker(port);
  }

  const client = initMqttSubscriber();
  return client;
};

module.exports = {
  initMqtt,
  getMqttClient
};
