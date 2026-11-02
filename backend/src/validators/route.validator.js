const validateCreateRoute = (body) => {
  const errors = [];
  const { name, routeCode, description, origin, destination, distanceKm, stops, status } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Route name is required' });
  }

  if (!routeCode || typeof routeCode !== 'string' || routeCode.trim().length === 0) {
    errors.push({ field: 'routeCode', message: 'Route code is required' });
  }

  const dist = distanceKm !== undefined ? parseFloat(distanceKm) : 0;
  if (isNaN(dist) || dist < 0) {
    errors.push({ field: 'distanceKm', message: 'Distance must be a non-negative number' });
  }

  if (stops !== undefined && !Array.isArray(stops)) {
    errors.push({ field: 'stops', message: 'Stops must be an array of stop objects or stop IDs' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: name ? name.trim() : '',
      routeCode: routeCode ? routeCode.trim().toUpperCase() : '',
      description: description ? description.trim() : null,
      origin: origin ? origin.trim() : null,
      destination: destination ? destination.trim() : null,
      distanceKm: dist,
      stops: Array.isArray(stops) ? stops : [],
      status: (status || 'active').toLowerCase()
    }
  };
};

const validateUpdateRoute = (body) => {
  const errors = [];
  const { name, routeCode, description, origin, destination, distanceKm, stops, status } = body;
  const sanitized = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Route name cannot be empty' });
    } else {
      sanitized.name = name.trim();
    }
  }

  if (routeCode !== undefined) {
    if (typeof routeCode !== 'string' || routeCode.trim().length === 0) {
      errors.push({ field: 'routeCode', message: 'Route code cannot be empty' });
    } else {
      sanitized.routeCode = routeCode.trim().toUpperCase();
    }
  }

  if (description !== undefined) {
    sanitized.description = description ? description.trim() : null;
  }

  if (origin !== undefined) {
    sanitized.origin = origin ? origin.trim() : null;
  }

  if (destination !== undefined) {
    sanitized.destination = destination ? destination.trim() : null;
  }

  if (distanceKm !== undefined) {
    const dist = parseFloat(distanceKm);
    if (isNaN(dist) || dist < 0) {
      errors.push({ field: 'distanceKm', message: 'Distance must be a non-negative number' });
    } else {
      sanitized.distanceKm = dist;
    }
  }

  if (stops !== undefined) {
    if (!Array.isArray(stops)) {
      errors.push({ field: 'stops', message: 'Stops must be an array' });
    } else {
      sanitized.stops = stops;
    }
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

const validateRouteStops = (body) => {
  const errors = [];
  const { stops } = body;

  if (!stops || !Array.isArray(stops)) {
    errors.push({ field: 'stops', message: 'Stops array is required' });
    return { isValid: false, errors };
  }

  const sanitizedStops = [];
  stops.forEach((s, idx) => {
    const stopId = typeof s === 'object' ? s.stopId : s;
    const stopOrder = typeof s === 'object' && s.stopOrder !== undefined ? s.stopOrder : idx + 1;

    if (!stopId || isNaN(parseInt(stopId, 10))) {
      errors.push({ field: `stops[${idx}].stopId`, message: 'Valid stopId is required' });
    } else {
      sanitizedStops.push({
        stopId: parseInt(stopId, 10),
        stopOrder: parseInt(stopOrder, 10)
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: { stops: sanitizedStops }
  };
};

module.exports = {
  validateCreateRoute,
  validateUpdateRoute,
  validateRouteStops
};
