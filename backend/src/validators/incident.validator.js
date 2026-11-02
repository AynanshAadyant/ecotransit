const { isValidCoordinate } = require('./common');

const VALID_INCIDENT_TYPES = [
  'vehicle_breakdown',
  'accident',
  'traffic',
  'route_blockage',
  'gps_failure',
  'vehicle_delay',
  'other'
];

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['reported', 'under_investigation', 'resolved', 'dismissed'];

const validateCreateIncident = (body) => {
  const errors = [];
  const { type, description, severity, latitude, longitude, vehicleId, routeId } = body;

  const incType = (type || '').toLowerCase().replace(/\s+/g, '_');
  if (!incType || !VALID_INCIDENT_TYPES.includes(incType)) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${VALID_INCIDENT_TYPES.join(', ')}`
    });
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  const incSeverity = (severity || 'medium').toLowerCase();
  if (!VALID_SEVERITIES.includes(incSeverity)) {
    errors.push({
      field: 'severity',
      message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}`
    });
  }

  if (latitude !== undefined && longitude !== undefined) {
    if (!isValidCoordinate(latitude, longitude)) {
      errors.push({ field: 'coordinates', message: 'Coordinates are invalid' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      type: incType,
      description: description ? description.trim() : '',
      severity: incSeverity,
      latitude: latitude !== undefined ? parseFloat(latitude) : null,
      longitude: longitude !== undefined ? parseFloat(longitude) : null,
      vehicleId: vehicleId ? parseInt(vehicleId, 10) : null,
      routeId: routeId ? parseInt(routeId, 10) : null
    }
  };
};

const validateUpdateIncident = (body) => {
  const errors = [];
  const { status, adminNotes, severity, description } = body;
  const sanitized = {};

  if (status !== undefined) {
    const incStatus = String(status).toLowerCase().replace(/\s+/g, '_');
    if (!VALID_STATUSES.includes(incStatus)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
      });
    } else {
      sanitized.status = incStatus;
    }
  }

  if (severity !== undefined) {
    const incSeverity = String(severity).toLowerCase();
    if (!VALID_SEVERITIES.includes(incSeverity)) {
      errors.push({
        field: 'severity',
        message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}`
      });
    } else {
      sanitized.severity = incSeverity;
    }
  }

  if (adminNotes !== undefined) {
    sanitized.adminNotes = adminNotes ? String(adminNotes).trim() : null;
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description cannot be empty' });
    } else {
      sanitized.description = description.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  validateCreateIncident,
  validateUpdateIncident
};
