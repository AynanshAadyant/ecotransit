const { isValidCoordinate } = require('./common');

/**
 * Validates GPS payload from ESP32 + NEO-6M
 * @param {object} payload 
 * @returns {object} { isValid: boolean, error?: string, sanitized?: object }
 */
const validateGpsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'GPS payload must be a JSON object' };
  }

  const { deviceId, vehicleId, latitude, longitude, speed, heading, timestamp } = payload;

  if (!deviceId && !vehicleId) {
    return { isValid: false, error: 'GPS payload must contain either deviceId or vehicleId' };
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
    return { isValid: false, error: `Invalid coordinates: lat=${latitude}, lng=${longitude}` };
  }

  // Realistic speed check (0 - 200 km/h for city transit buses)
  const spd = speed !== undefined ? parseFloat(speed) : 0;
  if (isNaN(spd) || spd < 0 || spd > 220) {
    return { isValid: false, error: `Invalid speed value: ${speed}` };
  }

  // Heading check (0 - 360 degrees)
  let hdg = heading !== undefined ? parseFloat(heading) : 0;
  if (isNaN(hdg) || hdg < 0 || hdg > 360) {
    hdg = 0;
  }

  // Timestamp check
  let ts = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(ts.getTime())) {
    ts = new Date();
  }

  // Check if timestamp is unreasonably far in future (e.g. > 1 hour)
  const now = Date.now();
  if (ts.getTime() > now + 3600 * 1000) {
    ts = new Date(now);
  }

  return {
    isValid: true,
    sanitized: {
      deviceId: deviceId ? String(deviceId).trim() : null,
      vehicleId: vehicleId ? parseInt(vehicleId, 10) : null,
      latitude: lat,
      longitude: lng,
      speed: spd,
      heading: hdg,
      timestamp: ts.toISOString()
    }
  };
};

module.exports = {
  validateGpsPayload
};
