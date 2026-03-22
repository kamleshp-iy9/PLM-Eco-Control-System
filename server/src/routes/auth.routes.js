const express = require('express');
const router = express.Router();
const { signup, login, refresh, getMe, forgotPassword } = require('../controllers/auth.controller');
const { signupValidator, loginValidator, forgotPasswordValidator } = require('../utils/validators');
const { authenticate } = require('../middleware/auth.middleware');
const { authAttemptLimiter, refreshLimiter } = require('../middleware/rate-limit.middleware');

router.post('/signup', authAttemptLimiter, signupValidator, signup);
router.post('/login', authAttemptLimiter, loginValidator, login);
router.post('/refresh', refreshLimiter, refresh);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', authAttemptLimiter, forgotPasswordValidator, forgotPassword);

module.exports = router;
