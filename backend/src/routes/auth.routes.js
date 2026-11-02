const express = require('express');
const authController = require('../controllers/auth.controller');
const { validateBody } = require('../validators/common');
const { validateLogin } = require('../validators/auth.validator');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', authLimiter, validateBody(validateLogin), authController.login);
router.get('/me', authenticate(), authController.getMe);

module.exports = router;
