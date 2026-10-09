const { isValidEmail } = require('./common');

const validateCreateStaff = (body) => {
  const errors = [];
  const { name, email, password, phone, role, status } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name is required (minimum 2 characters)' });
  }

  if (!email || !isValidEmail(email)) {
    errors.push({ field: 'email', message: 'A valid email address is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push({ field: 'password', message: 'Password is required (minimum 6 characters)' });
  }

  const validRoles = ['STAFF', 'ADMIN'];
  const userRole = (role || 'STAFF').toUpperCase();
  if (!validRoles.includes(userRole)) {
    errors.push({ field: 'role', message: 'Role must be either STAFF or ADMIN' });
  }

  const validStatuses = ['active', 'inactive', 'suspended'];
  const userStatus = (status || 'active').toLowerCase();
  if (!validStatuses.includes(userStatus)) {
    errors.push({ field: 'status', message: 'Status must be active, inactive, or suspended' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: name ? name.trim() : '',
      email: email ? email.trim().toLowerCase() : '',
      password: password || '',
      phone: phone ? String(phone).trim() : null,
      role: userRole,
      status: userStatus
    }
  };
};

const validateUpdateStaff = (body) => {
  const errors = [];
  const { name, email, password, phone, role, status } = body;
  const sanitized = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    } else {
      sanitized.name = name.trim();
    }
  }

  if (email !== undefined) {
    if (!isValidEmail(email)) {
      errors.push({ field: 'email', message: 'A valid email address is required' });
    } else {
      sanitized.email = email.trim().toLowerCase();
    }
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
    } else {
      sanitized.password = password;
    }
  }

  if (phone !== undefined) {
    sanitized.phone = phone ? String(phone).trim() : null;
  }

  if (role !== undefined) {
    const userRole = String(role).toUpperCase();
    if (!['STAFF', 'ADMIN'].includes(userRole)) {
      errors.push({ field: 'role', message: 'Role must be either STAFF or ADMIN' });
    } else {
      sanitized.role = userRole;
    }
  }

  if (status !== undefined) {
    const userStatus = String(status).toLowerCase();
    if (!['active', 'inactive', 'suspended'].includes(userStatus)) {
      errors.push({ field: 'status', message: 'Status must be active, inactive, or suspended' });
    } else {
      sanitized.status = userStatus;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  validateCreateStaff,
  validateUpdateStaff
};
