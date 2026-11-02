const { isValidCoordinate } = require('./common');

const validateCreateStop = (body) => {
  const errors = [];
  const { name, stopCode, latitude, longitude, address, status } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Stop name is required' });
  }

  if (!stopCode || typeof stopCode !== 'string' || stopCode.trim().length === 0) {
    errors.push({ field: 'stopCode', message: 'Stop code is required' });
  }

  if (latitude === undefined || longitude === undefined || !isValidCoordinate(latitude, longitude)) {
    errors.push({ field: 'coordinates', message: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: name ? name.trim() : '',
      stopCode: stopCode ? stopCode.trim().toUpperCase() : '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address ? address.trim() : null,
      status: (status || 'active').toLowerCase()
    }
  };
};

const validateUpdateStop = (body) => {
  const errors = [];
  const { name, stopCode, latitude, longitude, address, status } = body;
  const sanitized = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Stop name cannot be empty' });
    } else {
      sanitized.name = name.trim();
    }
  }

  if (stopCode !== undefined) {
    if (typeof stopCode !== 'string' || stopCode.trim().length === 0) {
      errors.push({ field: 'stopCode', message: 'Stop code cannot be empty' });
    } else {
      sanitized.stopCode = stopCode.trim().toUpperCase();
    }
  }

  if (latitude !== undefined || longitude !== undefined) {
    if (latitude === undefined || longitude === undefined || !isValidCoordinate(latitude, longitude)) {
      errors.push({ field: 'coordinates', message: 'Both latitude and longitude must be valid when updating position' });
    } else {
      sanitized.latitude = parseFloat(latitude);
      sanitized.longitude = parseFloat(longitude);
    }
  }

  if (address !== undefined) {
    sanitized.address = address ? address.trim() : null;
  }

  if (status !== undefined) {
    sanitized.status = String(status).toLowerCase();
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  validateCreateStop,
  validateUpdateStop
};
