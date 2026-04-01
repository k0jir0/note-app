const crypto = require('crypto');

const CSRF_SESSION_KEY = 'csrfToken';
const CSRF_BODY_FIELD = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

function ensureCsrfToken(req, res, next) {
    if (!req.session) {
        return next();
    }

    if (typeof req.session[CSRF_SESSION_KEY] !== 'string' || req.session[CSRF_SESSION_KEY].length === 0) {
        req.session[CSRF_SESSION_KEY] = generateCsrfToken();
    }

    res.locals.csrfToken = req.session[CSRF_SESSION_KEY];
    res.locals.csrfFieldName = CSRF_BODY_FIELD;
    res.locals.csrfHeaderName = CSRF_HEADER_NAME;

    return next();
}

function getSubmittedCsrfToken(req) {
    if (req.headers && typeof req.headers[CSRF_HEADER_NAME] === 'string') {
        return req.headers[CSRF_HEADER_NAME];
    }

    if (req.body && typeof req.body[CSRF_BODY_FIELD] === 'string') {
        return req.body[CSRF_BODY_FIELD];
    }

    return '';
}

function isValidCsrfToken(sessionToken, submittedToken) {
    if (typeof sessionToken !== 'string' || typeof submittedToken !== 'string') {
        return false;
    }

    const expected = Buffer.from(sessionToken, 'utf8');
    const actual = Buffer.from(submittedToken, 'utf8');

    if (expected.length === 0 || actual.length === 0 || expected.length !== actual.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, actual);
}

function rejectCsrfRequest(req, res) {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token'
        });
    }

    if (req.path === '/auth/login') {
        return res.status(403).render('pages/login', {
            title: 'Login',
            error: 'Your session expired. Please try again.'
        });
    }

    if (req.path === '/auth/signup') {
        return res.status(403).render('pages/signup', {
            title: 'Sign Up',
            error: 'Your session expired. Please try again.'
        });
    }

    return res.status(403).send('Invalid CSRF token');
}

function requireCsrfProtection(req, res, next) {
    if (SAFE_HTTP_METHODS.has(req.method)) {
        return next();
    }

    if (!req.session) {
        return rejectCsrfRequest(req, res);
    }

    const sessionToken = req.session[CSRF_SESSION_KEY];
    const submittedToken = getSubmittedCsrfToken(req);

    if (!isValidCsrfToken(sessionToken, submittedToken)) {
        return rejectCsrfRequest(req, res);
    }

    return next();
}

module.exports = {
    CSRF_BODY_FIELD,
    CSRF_HEADER_NAME,
    ensureCsrfToken,
    requireCsrfProtection,
    isValidCsrfToken
};
