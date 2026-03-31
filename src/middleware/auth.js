const { hasVerifiedRequestIdentity } = require('../services/apiAccessControlService');
const { handleAuthFailure } = require('../utils/errorHandler');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    try {
        if (hasVerifiedRequestIdentity(req)) {
            return next();
        }
    } catch (_error) {
        return handleAuthFailure(res, {
            api: false,
            statusCode: 302,
            redirectPath: '/auth/login'
        });
    }

    return res.redirect('/auth/login');
}

// Middleware to check if user is authenticated for API routes
function requireAuthAPI(req, res, next) {
    try {
        if (hasVerifiedRequestIdentity(req)) {
            return next();
        }
    } catch (_error) {
        return handleAuthFailure(res, {
            api: true,
            statusCode: 401
        });
    }

    return res.status(401).json({
        success: false,
        message: 'Unauthorized - Please log in',
        errors: ['Authentication is required to access this API resource.']
    });
}

module.exports = {
    requireAuth,
    requireAuthAPI
};
