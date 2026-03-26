const {
    buildVerifiedIdentityContext,
    hasVerifiedRequestIdentity,
    isProtectedApiPath,
    normalizeAccessPath
} = require('../services/apiAccessControlService');

function enforceServerSideApiAccessControl(req, res, next) {
    const requestPath = normalizeAccessPath(req.originalUrl || req.path || '');

    if (!isProtectedApiPath(requestPath)) {
        return next();
    }

    if (!hasVerifiedRequestIdentity(req)) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized - Server-side access control requires an authenticated identity',
            errors: ['This API endpoint is protected by the global server-side access-control gate.'],
            data: {
                method: String(req.method || 'GET').toUpperCase(),
                path: requestPath
            }
        });
    }

    const identityContext = buildVerifiedIdentityContext(req);
    req.serverAccessControl = identityContext;
    res.locals.serverAccessControl = identityContext;

    return next();
}

module.exports = {
    enforceServerSideApiAccessControl
};
