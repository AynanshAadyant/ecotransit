const validateCreateTrip = (body) => {
  const errors = [];
  const { vehicleId, routeId, staffId, status, startTime, notes } = body;

  if (!vehicleId || isNaN(parseInt(vehicleId, 10))) {
    errors.push({ field: 'vehicleId', message: 'Valid vehicleId is required' });
  }

  if (!routeId || isNaN(parseInt(routeId, 10))) {
    errors.push({ field: 'routeId', message: 'Valid routeId is required' });
  }

  const validStatuses = ['scheduled', 'active', 'completed', 'cancelled'];
  const tripStatus = (status || 'scheduled').toLowerCase();
  if (!validStatuses.includes(tripStatus)) {
    errors.push({ field: 'status', message: 'Status must be scheduled, active, completed, or cancelled' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      vehicleId: parseInt(vehicleId, 10),
      routeId: parseInt(routeId, 10),
      staffId: staffId ? parseInt(staffId, 10) : null,
      status: tripStatus,
      startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      notes: notes ? String(notes).trim() : null
    }
  };
};

const validateUpdateTrip = (body) => {
  const errors = [];
  const { status, notes, endTime } = body;
  const sanitized = {};

  if (status !== undefined) {
    const validStatuses = ['scheduled', 'active', 'completed', 'cancelled'];
    const tripStatus = String(status).toLowerCase();
    if (!validStatuses.includes(tripStatus)) {
      errors.push({ field: 'status', message: 'Status must be scheduled, active, completed, or cancelled' });
    } else {
      sanitized.status = tripStatus;
      if (tripStatus === 'completed' || tripStatus === 'cancelled') {
        sanitized.endTime = endTime ? new Date(endTime).toISOString() : new Date().toISOString();
      }
    }
  }

  if (notes !== undefined) {
    sanitized.notes = notes ? String(notes).trim() : null;
  }

  if (endTime !== undefined && !sanitized.endTime) {
    sanitized.endTime = new Date(endTime).toISOString();
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  validateCreateTrip,
  validateUpdateTrip
};
