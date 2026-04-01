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
const ACCOUNT_LOCKED_ERROR = 'This account is temporarily locked after repeated failed sign-in attempts. Please wait and try again.';
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

function normalizeBasePath(pathname = '') {
    const trimmedPathname = String(pathname || '').trim();
    if (!trimmedPathname || trimmedPathname === '/') {
        return '';
    }

    return `/${trimmedPathname.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function normalizeRequestPath(pathname = '') {
    const trimmedPathname = String(pathname || '').trim();
    if (!trimmedPathname || trimmedPathname === '/') {
        return '/';
    }

    return `/${trimmedPathname.replace(/^\/+/, '')}`;
}

function joinBasePath(basePath = '', requestPath = '/') {
    const normalizedBasePath = normalizeBasePath(basePath);
    const normalizedRequestPath = normalizeRequestPath(requestPath);

    if (!normalizedBasePath) {
        return normalizedRequestPath;
    }

    if (normalizedRequestPath === normalizedBasePath || normalizedRequestPath.startsWith(`${normalizedBasePath}/`)) {
        return normalizedRequestPath;
    }

    return normalizedRequestPath === '/'
        ? normalizedBasePath
        : `${normalizedBasePath}${normalizedRequestPath}`;
}

function canTrustForwardedHeaders(req) {
    const trustProxyFn = req && req.app && typeof req.app.get === 'function'
        ? req.app.get('trust proxy fn')
        : null;

    if (typeof trustProxyFn !== 'function') {
        return false;
    }

    const remoteAddress = req && req.socket ? req.socket.remoteAddress : undefined;
    return trustProxyFn(remoteAddress, 0);
}

function getRequestHost(req) {
    if (req && typeof req.host === 'string' && req.host.trim()) {
        return req.host.trim();
    }

    if (!req || typeof req.get !== 'function') {
        return '';
    }

    const host = req.get('host');
    return typeof host === 'string' ? host.trim() : '';
}

function getTrustedForwardedPrefix(req) {
    if (!canTrustForwardedHeaders(req) || !req || typeof req.get !== 'function') {
        return '';
    }

    const rawPrefix = req.get('x-forwarded-prefix');
    if (typeof rawPrefix !== 'string') {
        return '';
    }

    const normalizedPrefix = normalizeBasePath(rawPrefix.split(',')[0]);
    return normalizedPrefix;
}

function buildVisibleRequestUrl(req) {
    const host = getRequestHost(req);
    const protocol = req && typeof req.protocol === 'string' && req.protocol.trim()
        ? req.protocol.trim()
        : 'http';
    const requestTarget = req && typeof req.originalUrl === 'string' && req.originalUrl
        ? req.originalUrl
        : (req && typeof req.url === 'string' && req.url ? req.url : '/');

    if (!host) {
        return null;
    }

    const requestUrl = new URL(requestTarget, `${protocol}://${host}`);
    const forwardedPrefix = getTrustedForwardedPrefix(req);
    requestUrl.pathname = joinBasePath(forwardedPrefix, requestUrl.pathname);
    return requestUrl;
}

function buildCanonicalAppUrl(appBaseUrl, requestUrl) {
    const canonicalUrl = new URL(appBaseUrl);
    canonicalUrl.pathname = joinBasePath(canonicalUrl.pathname, requestUrl.pathname);
    canonicalUrl.search = requestUrl.search;
    return canonicalUrl;
}

function maybeRedirectToConfiguredAppBaseUrl(req, res) {
    const appBaseUrl = getConfiguredAppBaseUrl();
    if (!appBaseUrl || !req || typeof req.get !== 'function') {
        return false;
    }

    const visibleRequestUrl = buildVisibleRequestUrl(req);
    if (!visibleRequestUrl) {
        return false;
    }

    const canonicalTargetUrl = buildCanonicalAppUrl(appBaseUrl, visibleRequestUrl);
    if (visibleRequestUrl.toString() === canonicalTargetUrl.toString()) {
        return false;
    }

    res.redirect(canonicalTargetUrl.toString());
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
    ACCOUNT_LOCKED_ERROR,
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
