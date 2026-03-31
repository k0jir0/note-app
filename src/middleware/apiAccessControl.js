const {
    buildVerifiedIdentityContext,
    evaluateApiAccessPolicy,
    isProtectedApiPath,
    isPublicApiPath,
    normalizeAccessPath,
    sanitizeRequestSurfaces
} = require('../services/apiAccessControlService');
const { handleAuthFailure } = require('../utils/errorHandler');

function enforceServerSideApiAccessControl(req, res, next) {
    let requestPath = '/';

    try {
        requestPath = normalizeAccessPath(req.originalUrl || req.path || '');
        const apiRequest = isProtectedApiPath(requestPath) || isPublicApiPath(requestPath);

        if (!apiRequest) {
            return next();
        }

        const sanitizedRequest = sanitizeRequestSurfaces(req);

        req.zeroTrustInput = sanitizedRequest;
        res.locals.zeroTrustInput = sanitizedRequest;

        if (!isProtectedApiPath(requestPath)) {
            return next();
        }

        const authorization = evaluateApiAccessPolicy(req);

        if (!authorization.allowed) {
            const statusCode = authorization.policyId === 'authenticated-identity-required' ? 401 : 403;
            return res.status(statusCode).json({
                success: false,
                message: statusCode === 401
                    ? 'Unauthorized - Server-side access control requires an authenticated identity'
                    : 'Forbidden - Server-side access control denied the requested API action',
                errors: [authorization.reason],
                data: {
                    method: String(req.method || 'GET').toUpperCase(),
                    path: requestPath,
                    policyId: authorization.policyId,
                    requirement: authorization.requirement
                }
            });
        }

        const identityContext = buildVerifiedIdentityContext(req, authorization);
        req.serverAccessControl = identityContext;
        res.locals.serverAccessControl = identityContext;

        return next();
    } catch (_error) {
        return handleAuthFailure(res, {
            api: true,
            statusCode: 401,
            errors: ['The request could not be authenticated safely and has been denied.']
        });
    }
}

module.exports = {
    enforceServerSideApiAccessControl
};
