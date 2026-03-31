const bcrypt = require('bcrypt');
const User = require('../models/User');
const { getConfiguredAppBaseUrl, hasGoogleAuthCredentials } = require('../config/runtimeConfig');
const {
    SESSION_LOCK_REASONS,
    beginAuthenticatedSession,
    clearCurrentSessionBinding,
    getLoginReasonMessage
} = require('./sessionManagementService');

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const GOOGLE_OAUTH_EXCHANGE_ERROR_MESSAGE = 'Google sign-in could not be completed. Verify the configured Google OAuth client secret and redirect URI for this environment.';
const GENERIC_AUTH_SERVICE_ERROR = 'Authentication is temporarily unavailable. Please try again.';

function renderLoginPage(res, { error = null } = {}) {
    return res.render('pages/login', {
        title: 'Login',
        error,
        csrfToken: res.locals.csrfToken
    });
}

function renderSignupPage(res, { error = null } = {}) {
    return res.render('pages/signup', {
        title: 'Sign Up',
        error,
        csrfToken: res.locals.csrfToken
    });
}

function renderLogoutPage(res) {
    return res.render('pages/logout', {
        title: 'Logout',
        csrfToken: res.locals.csrfToken
    });
}

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

async function completeAuthenticatedLogin(req, user) {
    await regenerateSession(req);
    await logInUser(req, user);
    await beginAuthenticatedSession({
        user,
        session: req.session,
        runtimeConfig: req.app && req.app.locals ? req.app.locals.runtimeConfig : {}
    });
}

async function destroyAuthenticatedSession(req, res) {
    await clearCurrentSessionBinding({
        user: req.user,
        session: req.session,
        reason: SESSION_LOCK_REASONS.MANUAL_LOCKDOWN
    }).catch(() => false);

    await logoutUser(req);
    await destroySession(req);
    res.clearCookie('connect.sid');
}

async function findExistingUserByEmail(email) {
    return User.findOne({ email });
}

async function createLocalUser({ email, password }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
        email,
        password: hashedPassword
    });

    await user.save();
    return user;
}

module.exports = {
    GENERIC_AUTH_SERVICE_ERROR,
    GENERIC_LOGIN_ERROR,
    GOOGLE_OAUTH_EXCHANGE_ERROR_MESSAGE,
    completeAuthenticatedLogin,
    createLocalUser,
    destroyAuthenticatedSession,
    findExistingUserByEmail,
    getLoginReasonMessage,
    hasGoogleAuthCredentials,
    isGoogleTokenExchangeError,
    maybeRedirectToConfiguredAppBaseUrl,
    renderLoginPage,
    renderLogoutPage,
    renderSignupPage
};
