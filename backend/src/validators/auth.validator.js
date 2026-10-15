const { isValidEmail } = require('./common');

const validateLogin = (body) => {
  const errors = [];
  const identifier = body.identifier || body.email || body.username;
  const password = body.password;

  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    errors.push({ field: 'email', message: 'Email or username is required' });
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      identifier: identifier ? identifier.trim() : '',
      password: password || ''
    }
  };
};

module.exports = {
  validateLogin
};
