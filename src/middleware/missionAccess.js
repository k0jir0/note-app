const { evaluateMissionAccess } = require('../services/missionAccessControlService');

function resolveValue(valueOrResolver, req) {
    if (typeof valueOrResolver === 'function') {
        return valueOrResolver(req);
    }

    return valueOrResolver;
}

function requireMissionAccessAPI({ actionId, resourceId, contextResolver } = {}) {
    return function missionAccessApiMiddleware(req, res, next) {
        try {
            const resolvedActionId = resolveValue(actionId, req);
            const resolvedResourceId = resolveValue(resourceId, req);
            const resolvedContext = typeof contextResolver === 'function'
                ? (contextResolver(req) || {})
                : {};

            const decision = evaluateMissionAccess({
                user: req.user,
                actionId: resolvedActionId,
                resourceId: resolvedResourceId,
                contextOverrides: resolvedContext
            });

            req.missionAccessDecision = decision;
            res.locals.missionAccessDecision = decision;

            if (decision.allowed) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Forbidden - Mission policy denied the requested action',
                errors: decision.failedChecks.map((check) => check.detail),
                data: {
                    decision: decision.decision,
                    action: decision.action.id,
                    resource: decision.resource.id
                }
            });
        } catch (error) {
            if (error && (error.code === 'UNKNOWN_ACTION' || error.code === 'UNKNOWN_RESOURCE')) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: [error.message]
                });
            }

            return next(error);
        }
    };
}

module.exports = {
    requireMissionAccessAPI
};
