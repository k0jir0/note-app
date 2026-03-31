const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { getConfiguredAppBaseUrl, hasGoogleAuthCredentials } = require('../config/runtimeConfig');
const { authRateLimiter } = require('../middleware/rateLimit');
const { CSRF_BODY_FIELD } = require('../middleware/csrf');
const {
    validateEmail,
    validatePassword,
    validateLoginPassword,
    sanitizeAuthPayload
} = require('../utils/validation');
const {
    SESSION_LOCK_REASONS,
    beginAuthenticatedSession,
    clearCurrentSessionBinding,
    getLoginReasonMessage
} = require('../services/sessionManagementService');
const { handleAuthFailure } = require('../utils/errorHandler');

const router = express.Router();

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const AUTH_PAYLOAD_FIELDS = ['email', 'password', CSRF_BODY_FIELD];
const GOOGLE_OAUTH_EXCHANGE_ERROR_MESSAGE = 'Google sign-in could not be completed. Verify the configured Google OAuth client secret and redirect URI for this environment.';
const GENERIC_AUTH_SERVICE_ERROR = 'Authentication is temporarily unavailable. Please try again.';

function isGoogleTokenExchangeError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const errorName = typeof error.name === 'string' ? error.name : '';
    const errorMessage = typeof error.message === 'string' ? error.message : '';

    return errorName === 'TokenError'
        || errorName === 'InternalOAuthError'
        || errorMessage.includes('Failed to obtain access token');
}

function renderLogoutPage(res) {
    return res.render('pages/logout', {
        title: 'Logout',
        csrfToken: res.locals.csrfToken
    });
}

function regenerateSession(req) {
    if (!req.session || typeof req.session.regenerate !== 'function') {
        return Promise.reject(new Error('Session regeneration is unavailable'));
    }

    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function logInUser(req, user) {
    if (!req || typeof req.logIn !== 'function') {
        return Promise.reject(new Error('Session login is unavailable'));
    }

    return new Promise((resolve, reject) => {
        req.logIn(user, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function logoutUser(req) {
    if (!req || typeof req.logout !== 'function') {
        return Promise.reject(new Error('Logout is unavailable'));
    }

    return new Promise((resolve, reject) => {
        req.logout((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function destroySession(req) {
    if (!req.session || typeof req.session.destroy !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        req.session.destroy((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function completeAuthenticatedLogin(req, res, next, user) {
    try {
        await regenerateSession(req);
        await logInUser(req, user);
        await beginAuthenticatedSession({
            user,
            session: req.session,
            runtimeConfig: req.app && req.app.locals ? req.app.locals.runtimeConfig : {}
        });

        return res.redirect('/');
    } catch (_error) {
        return handleAuthFailure(res, {
            api: false,
            statusCode: 503,
            pageTitle: 'Login',
            pageError: GENERIC_AUTH_SERVICE_ERROR,
            csrfToken: res.locals.csrfToken
        });
    }
}

function maybeRedirectToConfiguredAppBaseUrl(req, res) {
    const appBaseUrl = getConfiguredAppBaseUrl();
    if (!appBaseUrl || !req || typeof req.get !== 'function') {
        return false;
    }

    const currentOrigin = `${req.protocol}://${req.get('host')}`;
    if (currentOrigin === appBaseUrl) {
        return false;
    }

    res.redirect(`${appBaseUrl}${req.originalUrl}`);
    return true;
}

async function destroyAuthenticatedSession(req, res, next) {
    try {
        await clearCurrentSessionBinding({
            user: req.user,
            session: req.session,
            reason: SESSION_LOCK_REASONS.MANUAL_LOCKDOWN
        }).catch(() => false);

        await logoutUser(req);
        await destroySession(req);
        res.clearCookie('connect.sid');
        return res.redirect('/auth/login');
    } catch (_error) {
        return handleAuthFailure(res, {
            api: false,
            statusCode: 503,
            pageTitle: 'Logout',
            pageError: 'Logout could not be completed safely.',
            csrfToken: res.locals.csrfToken
        });
    }
}

// GET login page
router.get('/login', (req, res) => {
    const sessionReason = typeof req.query?.reason === 'string'
        ? getLoginReasonMessage(req.query.reason)
        : '';

    res.render('pages/login', {
        title: 'Login',
        error: sessionReason || null,
        csrfToken: res.locals.csrfToken
    });
});

// POST login
router.post('/login', authRateLimiter, (req, res, next) => {
    const { email, password } = sanitizeAuthPayload(req.body);

    // Only process expected fields in auth payloads
    const bodyKeys = Object.keys(req.body || {});
    const hasUnexpectedFields = bodyKeys.some((key) => !AUTH_PAYLOAD_FIELDS.includes(key));
    if (hasUnexpectedFields) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: 'Invalid login request payload',
            csrfToken: res.locals.csrfToken
        });
    }

    // Basic validation
    if (!email || !password) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: 'Please provide both email and password',
            csrfToken: res.locals.csrfToken
        });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: emailValidation.error,
            csrfToken: res.locals.csrfToken
        });
    }

    const passwordValidation = validateLoginPassword(password);
    if (!passwordValidation.isValid) {
        return res.status(400).render('pages/login', {
            title: 'Login',
            error: passwordValidation.error,
            csrfToken: res.locals.csrfToken
        });
    }

    req.body.email = email;
    req.body.password = password;

    return passport.authenticate('local', (err, user, _info) => {
        if (err) {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!user) {
            return res.status(401).render('pages/login', {
                title: 'Login',
                error: GENERIC_LOGIN_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!req.session || typeof req.session.regenerate !== 'function') {
            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        return completeAuthenticatedLogin(req, res, next, user);
    })(req, res, next);
});

// GET signup page
router.get('/signup', (req, res) => {
    res.render('pages/signup', {
        title: 'Sign Up',
        error: null,
        csrfToken: res.locals.csrfToken
    });
});

// POST signup
router.post('/signup', authRateLimiter, async (req, res) => {
    try {
        const { email, password } = sanitizeAuthPayload(req.body);

        const bodyKeys = Object.keys(req.body || {});
        const hasUnexpectedFields = bodyKeys.some((key) => !AUTH_PAYLOAD_FIELDS.includes(key));
        if (hasUnexpectedFields) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: 'Invalid signup request payload',
                csrfToken: res.locals.csrfToken
            });
        }

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: emailValidation.error,
                csrfToken: res.locals.csrfToken
            });
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).render('pages/signup', {
                title: 'Sign Up',
                error: passwordValidation.errors.join('. '),
                csrfToken: res.locals.csrfToken
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect('/auth/login');
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
                error: errorMessages.join('. '),
                csrfToken: res.locals.csrfToken
            });
        }

        res.status(500).render('pages/signup', {
            title: 'Sign Up',
            error: 'An error occurred during signup. Please try again.',
            csrfToken: res.locals.csrfToken
        });
    }
});

// GET logout confirmation page
router.get('/logout', (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    return renderLogoutPage(res);
});

// POST logout
router.post('/logout', (req, res, next) => {
    return destroyAuthenticatedSession(req, res, next);
});

// Google Auth
router.get('/login/federated/google', (req, res, next) => {
    if (!hasGoogleAuthCredentials()) {
        return res.status(503).render('pages/login', {
            title: 'Login',
            error: 'Google sign-in is not configured',
            csrfToken: res.locals.csrfToken
        });
    }

    if (maybeRedirectToConfiguredAppBaseUrl(req, res)) {
        return undefined;
    }

    return passport.authenticate('google')(req, res, next);
});

router.get('/oauth2/redirect/google', (req, res, next) => {
    if (!hasGoogleAuthCredentials()) {
        return res.status(503).render('pages/login', {
            title: 'Login',
            error: 'Google sign-in is not configured',
            csrfToken: res.locals.csrfToken
        });
    }

    if (maybeRedirectToConfiguredAppBaseUrl(req, res)) {
        return undefined;
    }

    return passport.authenticate('google', (err, user, _info) => {
        if (err) {
            if (isGoogleTokenExchangeError(err)) {
                console.warn('[auth] Google token exchange failed. Verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL, and the Google Cloud redirect URI for this environment.');
                return res.status(502).render('pages/login', {
                    title: 'Login',
                    error: GOOGLE_OAUTH_EXCHANGE_ERROR_MESSAGE,
                    csrfToken: res.locals.csrfToken
                });
            }

            return handleAuthFailure(res, {
                api: false,
                statusCode: 503,
                pageTitle: 'Login',
                pageError: GENERIC_AUTH_SERVICE_ERROR,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!user) {
            return res.redirect('/auth/login');
        }

        return completeAuthenticatedLogin(req, res, next, user);
    })(req, res, next);
});

module.exports = router;
