const { errorResponse } = require('../utils/response');

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {  
  console.error('Unhandled Application Error:', err);

  // Body parser bad JSON error
  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, 'Malformed JSON payload in request body.', 400);
  }

  // Database unique constraint violation
  if (err.code === '23505') {
    const detail = err.detail || 'Duplicate key value violates unique constraint.';
    return errorResponse(res, detail, 409);
  }

  // Database foreign key violation
  if (err.code === '23503') {
    const detail = err.detail || 'Foreign key violation: referenced record does not exist or is in use.';
    return errorResponse(res, detail, 400);
  }

  // Generic client bad request
  if (err.status && err.status < 500) {
    return errorResponse(res, err.message, err.status);
  }

  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  return errorResponse(res, message, 500);
};

/**
 * 404 Route Not Found Handler
 */
const notFoundHandler = (req, res) => {
  return errorResponse(res, `Cannot ${req.method} ${req.originalUrl} - Route Not Found`, 404);
};

module.exports = {
  errorHandler,
  notFoundHandler
};
