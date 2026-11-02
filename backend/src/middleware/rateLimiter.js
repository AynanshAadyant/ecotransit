const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // default 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '500', 10);

const apiLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many requests from this IP, please try again later.', 429);
  }
});

// Stricter rate limit for authentication attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 30, // 30 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many login attempts. Please try again after 15 minutes.', 429);
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
