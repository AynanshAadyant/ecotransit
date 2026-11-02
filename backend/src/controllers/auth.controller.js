const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response');

class AuthController {
  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;
      const result = await authService.login(identifier, password);
      return successResponse(res, result, 'Login successful', 200);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      return successResponse(res, user, 'User profile retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
