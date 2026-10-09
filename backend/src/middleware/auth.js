const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');

/**
 * Authentication Middleware
 * Extracts and verifies JWT from Authorization header
 */
const authenticate = (dbClient = null) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse(res, 'Authentication required. Missing or malformed token.', 401);
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return errorResponse(res, 'Authentication token not provided.', 401);
      }

      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return errorResponse(res, 'Token has expired. Please login again.', 401);
        }
        return errorResponse(res, 'Invalid authentication token.', 401);
      }

      // If db connection available, verify user status in DB
      const db = dbClient || require('../config/db');
      const result = await db.query(
        'SELECT id, name, email, role, status, phone FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return errorResponse(res, 'User associated with this token no longer exists.', 401);
      }

      const user = result.rows[0];
      if (user.status !== 'active') {
        return errorResponse(res, 'User account is inactive or suspended.', 403);
      }

      // Attach user context to request
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toUpperCase(),
        status: user.status,
        phone: user.phone
      };

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return errorResponse(res, 'Internal authentication error.', 500);
    }
  };
};

/**
 * Role-Based Authorization Middleware
 * @param  {...string} allowedRoles - e.g. "admin", "staff" or "ADMIN"
 */
const authorize = (...allowedRoles) => {
  // Normalize allowed roles to uppercase
  const flatRoles = allowedRoles.flat().map(r => String(r).toUpperCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 'Unauthorized. Please authenticate first.', 401);
    }

    const userRole = req.user.role.toUpperCase();
    if (!flatRoles.includes(userRole)) {
      return errorResponse(
        res,
        `Forbidden: Role '${userRole}' does not have sufficient permissions for this resource.`,
        403
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
