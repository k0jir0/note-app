const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { hasGoogleAuthCredentials } = require('../config/runtimeConfig');
const { authRateLimiter } = require('../middleware/rateLimit');
const {
    validateEmail,
    validatePassword,
    validateLoginPassword,
    sanitizeAuthPayload
} = require('../utils/validation');

const router = express.Router();

function destroyAuthenticatedSession(req, res, next) {
    req.logout((logoutError) => {
        if (logoutError) {
            if (typeof next === 'function') {
                return next(logoutError);
            }

            return res.status(500).json({ error: 'Logout failed' });
        }

        if (!req.session || typeof req.session.destroy !== 'function') {
            res.clearCookie('connect.sid');
            return res.redirect('/auth/login');
        }

        return req.session.destroy((sessionError) => {
            if (sessionError) {
                if (typeof next === 'function') {
                    return next(sessionError);
                }

                return res.status(500).json({ error: 'Logout failed' });
            }

            res.clearCookie('connect.sid');
            return res.redirect('/auth/login');
        });
    });
}

// GET login page
router.get('/login', (req, res) => {
    res.render('pages/login', { title: 'Login', error: null });
});

// POST login
router.post('/login', authRateLimiter, (req, res, next) => {
    const { email, password } = sanitizeAuthPayload(req.body);

    // Only process expected fields in auth payloads
    const bodyKeys = Object.keys(req.body || {});
    const hasUnexpectedFields = bodyKeys.some((key) => !['email', 'password'].includes(key));
    if (hasUnexpectedFields) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: 'Invalid login request payload'
        });
    }

    // Basic validation
    if (!email || !password) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: 'Please provide both email and password'
        });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: emailValidation.error
        });
    }

    const passwordValidation = validateLoginPassword(password);
    if (!passwordValidation.isValid) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: passwordValidation.error
        });
    }

    req.body.email = email;
    req.body.password = password;

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            if (info && info.code === 'GOOGLE_AUTH_REQUIRED') {
                return res.redirect('/auth/login/federated/google');
            }

            return res.status(401).render('pages/login', {
                title: 'Login',
                error: info.message || 'Invalid email or password'
            });
        }

        if (!req.session || typeof req.session.regenerate !== 'function') {
            return next(new Error('Session regeneration is unavailable'));
        }

        return req.session.regenerate((regenerateError) => {
            if (regenerateError) {
                return next(regenerateError);
            }

            return req.logIn(user, (loginError) => {
                if (loginError) {
                    return next(loginError);
                }

                return res.redirect('/');
            });
        });
    })(req, res, next);
});

// GET signup page
router.get('/signup', (req, res) => {
    res.render('pages/signup', { title: 'Sign Up', error: null });
});

// POST signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = sanitizeAuthPayload(req.body);

        const bodyKeys = Object.keys(req.body || {});
        const hasUnexpectedFields = bodyKeys.some((key) => !['email', 'password'].includes(key));
        if (hasUnexpectedFields) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: 'Invalid signup request payload'
            });
        }

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: emailValidation.error
            });
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: passwordValidation.errors.join('. ')
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).render('pages/signup', {
                title: 'Sign Up',
                error: 'This email is already registered. Please login or use a different email.'
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const user = new User({
            email,
            password: hashedPassword
        });

        // Save the user
        await user.save();

        // Redirect to login
        res.redirect('/auth/login');
    } catch (err) {
        // Handle validation errors from Mongoose
        if (err.name === 'ValidationError') {
            const errorMessages = Object.values(err.errors).map(e => e.message);
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: errorMessages.join('. ')
            });
        }

        res.status(500).render('pages/signup', {
            title: 'Sign Up',
            error: 'An error occurred during signup. Please try again.'
        });
    }
});

// POST logout
router.post('/logout', (req, res, next) => {
    destroyAuthenticatedSession(req, res, next);
});

// Google Auth
router.get('/login/federated/google', (req, res, next) => {
    if (!hasGoogleAuthCredentials()) {
        return res.status(503).render('pages/login', {
            title: 'Login',
            error: 'Google sign-in is not configured'
        });
    }

    return passport.authenticate('google')(req, res, next);
});

router.get('/oauth2/redirect/google', (req, res, next) => {
    if (!hasGoogleAuthCredentials()) {
        return res.status(503).render('pages/login', {
            title: 'Login',
            error: 'Google sign-in is not configured'
        });
    }

    return passport.authenticate('google', {
        successRedirect: '/',
        failureRedirect: '/auth/login'
    })(req, res, next);
});

module.exports = router;
