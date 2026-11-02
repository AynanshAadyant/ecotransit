const db = require('../config/db');
const { comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

class AuthService {
  /**
   * Authenticate user with email or username and password
   * @param {string} identifier - email or username
   * @param {string} password - plain text password
   */
  async login(identifier, password) {
    const cleanIdentifier = (identifier || '').trim().toLowerCase();

    // Look up user by email
    const queryText = `
      SELECT id, name, email, password_hash, phone, role, status, created_at, updated_at
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
    `;

    const result = await db.query(queryText, [cleanIdentifier]);
    if (result.rows.length === 0) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    const user = result.rows[0];

    // Check account status
    if (user.status !== 'active') {
      const error = new Error('Your account is currently inactive or suspended. Please contact administrator.');
      error.status = 403;
      throw error;
    }

    // Verify bcrypt password
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toUpperCase()
    };
    const token = generateToken(tokenPayload);

    // Omit sensitive password_hash from response
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.toUpperCase(),
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    };
  }

  /**
   * Get user profile by ID
   * @param {number} userId 
   */
  async getProfile(userId) {
    const queryText = `
      SELECT id, name, email, phone, role, status, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(queryText, [userId]);
    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    const user = result.rows[0];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.toUpperCase(),
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }
}

module.exports = new AuthService();
