const { hasVerifiedRequestIdentity } = require('../services/apiAccessControlService');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (hasVerifiedRequestIdentity(req)) {
        return next();
    }
    res.redirect('/auth/login');
}

// Middleware to check if user is authenticated for API routes
function requireAuthAPI(req, res, next) {
    if (hasVerifiedRequestIdentity(req)) {
        return next();
    }
    res.status(401).json({
        success: false,
        message: 'Unauthorized - Please log in'
    });
}

module.exports = {
    requireAuth,
    requireAuthAPI
};
