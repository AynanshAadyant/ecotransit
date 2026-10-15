const validateCreateVehicle = (body) => {
  const errors = [];
  const {
    vehicleNumber,
    registrationNumber,
    vehicleType,
    capacity,
    routeId,
    deviceId,
    status
  } = body;

  if (!vehicleNumber || typeof vehicleNumber !== 'string' || vehicleNumber.trim().length === 0) {
    errors.push({ field: 'vehicleNumber', message: 'Vehicle number is required' });
  }

  if (!registrationNumber || typeof registrationNumber !== 'string' || registrationNumber.trim().length === 0) {
    errors.push({ field: 'registrationNumber', message: 'Registration number is required' });
  }

  const validStatuses = ['active', 'maintenance', 'inactive'];
  const vehStatus = (status || 'active').toLowerCase();
  if (!validStatuses.includes(vehStatus)) {
    errors.push({ field: 'status', message: 'Status must be active, maintenance, or inactive' });
  }

  const parsedCapacity = capacity !== undefined ? parseInt(capacity, 10) : 40;
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    errors.push({ field: 'capacity', message: 'Capacity must be a positive integer' });
  }

  const parsedRouteId = routeId !== undefined && routeId !== null && routeId !== ''
    ? parseInt(routeId, 10)
    : null;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      vehicleNumber: vehicleNumber ? vehicleNumber.trim().toUpperCase() : '',
      registrationNumber: registrationNumber ? registrationNumber.trim().toUpperCase() : '',
      vehicleType: vehicleType ? vehicleType.trim() : 'Electric Bus',
      capacity: parsedCapacity,
      routeId: parsedRouteId,
      deviceId: deviceId ? deviceId.trim() : null,
      status: vehStatus
    }
  };
};

const validateUpdateVehicle = (body) => {
  const errors = [];
  const {
    vehicleNumber,
    registrationNumber,
    vehicleType,
    capacity,
    routeId,
    deviceId,
    status
  } = body;

  const sanitized = {};

  if (vehicleNumber !== undefined) {
    if (typeof vehicleNumber !== 'string' || vehicleNumber.trim().length === 0) {
      errors.push({ field: 'vehicleNumber', message: 'Vehicle number cannot be empty' });
    } else {
      sanitized.vehicleNumber = vehicleNumber.trim().toUpperCase();
    }
  }

  if (registrationNumber !== undefined) {
    if (typeof registrationNumber !== 'string' || registrationNumber.trim().length === 0) {
      errors.push({ field: 'registrationNumber', message: 'Registration number cannot be empty' });
    } else {
      sanitized.registrationNumber = registrationNumber.trim().toUpperCase();
    }
  }

  if (vehicleType !== undefined) {
    sanitized.vehicleType = vehicleType.trim();
  }

  if (capacity !== undefined) {
    const parsed = parseInt(capacity, 10);
    if (isNaN(parsed) || parsed <= 0) {
      errors.push({ field: 'capacity', message: 'Capacity must be a positive integer' });
    } else {
      sanitized.capacity = parsed;
    }
  }

  if (routeId !== undefined) {
    sanitized.routeId = routeId !== null && routeId !== '' ? parseInt(routeId, 10) : null;
  }

  if (deviceId !== undefined) {
    sanitized.deviceId = deviceId ? deviceId.trim() : null;
  }

  if (status !== undefined) {
    const vehStatus = String(status).toLowerCase();
    if (!['active', 'maintenance', 'inactive'].includes(vehStatus)) {
      errors.push({ field: 'status', message: 'Status must be active, maintenance, or inactive' });
    } else {
      sanitized.status = vehStatus;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  validateCreateVehicle,
  validateUpdateVehicle
};
