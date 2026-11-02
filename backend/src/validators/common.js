const { errorResponse } = require('../utils/response');

/**
 * Validates request body using a validator function
 * If validation fails, responds with 400 Bad Request
 */
const validateBody = (validationFn) => {
  return (req, res, next) => {
    const { isValid, errors, sanitized } = validationFn(req.body || {});
    if (!isValid) {
      return errorResponse(res, 'Validation failed', 400, errors);
    }
    if (sanitized) {
      req.body = sanitized;
    }
    next();
  };
};

const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

const isValidCoordinate = (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Reject exact 0,0 which usually indicates GPS fix failure / no signal from NEO-6M
  if (latitude === 0 && longitude === 0) return false;
  return true;
};

module.exports = {
  validateBody,
  isValidEmail,
  isValidCoordinate
};
