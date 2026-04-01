const {
    PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS,
    canManageBreakGlassRuntime,
    canMutatePrivilegedRuntime,
    canReadPrivilegedRuntime,
    hasRecentHardwareStepUp
} = require('../services/privilegedRuntimeAccessService');

function denyAccess(res, {
    api = true,
    statusCode = 403,
    message,
    errors = [message]
} = {}) {
    if (api) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors
        });
    }

    return res.status(statusCode).send(message);
}

function requirePrivilegedDevToolsEnabled({ api = true } = {}) {
    return function privilegedDevToolsEnabled(req, res, next) {
        const enabled = Boolean(req.app && req.app.locals && req.app.locals.privilegedDevToolsEnabled);
        if (enabled) {
            return next();
        }

        return denyAccess(res, {
            api,
            message: 'Privileged development tooling is disabled for this environment.',
            errors: ['Privileged development tooling is not enabled for this environment.']
        });
    };
}

function requireBreakGlassRuntimeAccess({ api = true } = {}) {
    return function breakGlassRuntimeAccess(req, res, next) {
        if (canManageBreakGlassRuntime(req.user)) {
            return next();
        }

        return denyAccess(res, {
            api,
            message: 'Break-glass runtime controls require an admin or break_glass role.',
            errors: ['Break-glass runtime controls require an admin or break_glass role.']
        });
    };
}

function requirePrivilegedRuntimeReadAccess({ api = true } = {}) {
    return function privilegedRuntimeReadAccess(req, res, next) {
        if (canReadPrivilegedRuntime(req.user)) {
            return next();
        }

        return denyAccess(res, {
            api,
            message: 'Privileged runtime diagnostics require an admin session.',
            errors: ['Privileged runtime diagnostics require an admin session.']
        });
    };
}

function requirePrivilegedRuntimeMutationAccess({ api = true } = {}) {
    return function privilegedRuntimeMutationAccess(req, res, next) {
        if (canMutatePrivilegedRuntime(req.user)) {
            return next();
        }

        return denyAccess(res, {
            api,
            message: 'Privileged runtime changes require an admin session.',
            errors: ['Privileged runtime changes require an admin session.']
        });
    };
}

function requireRecentPrivilegedStepUp({
    api = true,
    maxAgeMs = PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS
} = {}) {
    return function recentPrivilegedStepUp(req, res, next) {
        if (hasRecentHardwareStepUp(req.session, { maxAgeMs })) {
            return next();
        }

        return denyAccess(res, {
            api,
            message: 'A recent hardware-first MFA step-up is required for this privileged action.',
            errors: ['A recent hardware-first MFA step-up is required for this privileged action.']
        });
    };
}

module.exports = {
    requireBreakGlassRuntimeAccess,
    requirePrivilegedDevToolsEnabled,
    requirePrivilegedRuntimeMutationAccess,
    requirePrivilegedRuntimeReadAccess,
    requireRecentPrivilegedStepUp
};
