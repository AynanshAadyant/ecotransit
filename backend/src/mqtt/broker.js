const net = require('net');

let aedesInstance = null;
let brokerServer = null;

/**
 * Start an embedded MQTT broker using Aedes
 * @param {number} port 
 */
const startEmbeddedBroker = (port = 1883) => {
  return new Promise((resolve) => {
    try {
      const Aedes = require('aedes');
      aedesInstance = new Aedes();
      brokerServer = net.createServer(aedesInstance.handle);

      brokerServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[MQTT Broker] Port ${port} is already in use by an external MQTT broker (e.g. Mosquitto). Using external broker.`);
          resolve(false);
        } else {
          console.warn('[MQTT Broker] Embedded broker error:', err.message);
          resolve(false);
        }
      });

      brokerServer.listen(port, () => {
        console.log(`[MQTT Broker] Embedded Aedes MQTT broker running on port ${port}`);
        resolve(true);
      });
    } catch (err) {
      console.warn('[MQTT Broker] Could not initialize Aedes broker:', err.message);
      resolve(false);
    }
  });
};

const stopEmbeddedBroker = () => {
  if (brokerServer) {
    brokerServer.close();
  }
};

module.exports = {
  startEmbeddedBroker,
  stopEmbeddedBroker
};
