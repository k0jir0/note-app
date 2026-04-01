const express = require('express');

const { authRateLimiter } = require('../middleware/rateLimit');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/login', authController.renderLogin);
router.post('/login', authRateLimiter, authController.handleLogin);

router.get('/signup', authController.renderSignup);
router.post('/signup', authRateLimiter, authController.handleSignup);

router.get('/logout', authController.renderLogout);
router.post('/logout', authController.handleLogout);

router.get('/login/federated/google', authController.beginGoogleLogin);
router.get('/oauth2/redirect/google', authController.handleGoogleCallback);

module.exports = router;
