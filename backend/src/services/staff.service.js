const db = require('../config/db');
const { hashPassword } = require('../utils/password');

class StaffService {
  /**
   * List all staff accounts (with optional filtering by role or status)
   */
  async getAllStaff(filters = {}) {
    let queryText = `
      SELECT id, name, email, phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
    `;
    const conditions = [];
    const params = [];

    if (filters.role) {
      params.push(filters.role.toUpperCase());
      conditions.push(`role = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status.toLowerCase());
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY id ASC';

    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Get single staff member by ID
   */
  async getStaffById(id) {
    const queryText = `
      SELECT id, name, email, phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(queryText, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Staff member not found');
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  }

  /**
   * Create a new staff / admin account
   */
  async createStaff(data) {
    const { name, email, password, phone, role, status } = data;

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      const error = new Error('A user with this email address already exists');
      error.status = 409;
      throw error;
    }

    const passwordHash = await hashPassword(password);
    const userRole = (role || 'STAFF').toUpperCase();
    const userStatus = (status || 'active').toLowerCase();

    const insertText = `
      INSERT INTO users (name, email, password_hash, phone, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, email, phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(insertText, [name, email, passwordHash, phone, userRole, userStatus]);
    return result.rows[0];
  }

  /**
   * Update existing staff member
   */
  async updateStaff(id, data) {
    const current = await this.getStaffById(id);

    const updates = [];
    const params = [id];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }

    if (data.email !== undefined && data.email !== current.email) {
      const check = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [data.email, id]);
      if (check.rows.length > 0) {
        const error = new Error('Email is already taken by another user');
        error.status = 409;
        throw error;
      }
      params.push(data.email);
      updates.push(`email = $${params.length}`);
    }

    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      params.push(passwordHash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (data.phone !== undefined) {
      params.push(data.phone);
      updates.push(`phone = $${params.length}`);
    }

    if (data.role !== undefined) {
      params.push(data.role.toUpperCase());
      updates.push(`role = $${params.length}`);
    }

    if (data.status !== undefined) {
      params.push(data.status.toLowerCase());
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, name, email, phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const result = await db.query(updateQuery, params);
    return result.rows[0];
  }

  /**
   * Delete staff member
   */
  async deleteStaff(id) {
    await this.getStaffById(id);

    const deleteQuery = 'DELETE FROM users WHERE id = $1 RETURNING id';
    await db.query(deleteQuery, [id]);
    return { id: parseInt(id, 10), message: 'Staff member deleted successfully' };
  }
}

module.exports = new StaffService();
