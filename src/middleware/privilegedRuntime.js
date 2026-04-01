const {
    PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS,
    canManageBreakGlassRuntime,
    canMutatePrivilegedRuntime,
    canReadPrivilegedRuntime,
    hasRecentHardwareStepUp
} = require('../services/privilegedRuntimeAccessService');

function resolveMissionRole(req = {}) {
    return String(req.user && req.user.accessProfile && req.user.accessProfile.missionRole || '')
        .trim()
        .toLowerCase();
}

function emitPrivilegedAccessDeniedAudit(req, {
    actionId = '',
    resourceId = '',
    message = 'Privileged action denied.',
    reason = ''
} = {}) {
    const client = req && req.app && req.app.locals ? req.app.locals.immutableLogClient : null;
    if (!client || !client.enabled || typeof client.audit !== 'function') {
        return;
    }

    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.originalUrl || req.path || '');
    const missionRole = resolveMissionRole(req);
    const userId = req && req.user && req.user._id ? String(req.user._id) : '';
    const email = req && req.user && req.user.email ? String(req.user.email) : '';
    const hasStepUp = hasRecentHardwareStepUp(req && req.session ? req.session : null);

    void Promise.resolve(client.audit(message, {
        category: 'authorization',
        outcome: 'denied',
        userId,
        method,
        path,
        statusCode: 403,
        who: {
            type: req && req.user ? 'user' : 'anonymous',
            userId,
            email,
            displayName: email || userId || 'anonymous-user',
            missionRole
        },
        what: {
            intent: 'privileged-runtime',
            actionId,
            resourceId,
            decision: 'deny',
            reason
        },
        where: {
            channel: 'http',
            method,
            path,
            ip: req && req.ip ? String(req.ip) : '',
            userAgent: req && typeof req.get === 'function' ? String(req.get('user-agent') || '') : ''
        },
        how: {
            mechanism: 'privileged-runtime-middleware',
            missionRole,
            recentHardwareStepUp: hasStepUp
        }
    })).catch(() => {});
}

function denyAccess(req, res, {
    api = true,
    statusCode = 403,
    message,
    errors = [message],
    actionId = '',
    resourceId = '',
    reason = ''
} = {}) {
    emitPrivilegedAccessDeniedAudit(req, {
        actionId,
        resourceId,
        message,
        reason
    });

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

        return denyAccess(req, res, {
            api,
            message: 'Privileged development tooling is disabled for this environment.',
            errors: ['Privileged development tooling is not enabled for this environment.'],
            actionId: 'access_privileged_dev_tools',
            resourceId: 'privileged-dev-tools',
            reason: 'privileged_dev_tools_disabled'
        });
    };
}

function requireBreakGlassRuntimeAccess({ api = true } = {}) {
    return function breakGlassRuntimeAccess(req, res, next) {
        if (canManageBreakGlassRuntime(req.user)) {
            return next();
        }

        return denyAccess(req, res, {
            api,
            message: 'Break-glass runtime controls require an admin or break_glass role.',
            errors: ['Break-glass runtime controls require an admin or break_glass role.'],
            actionId: 'manage_break_glass_runtime',
            resourceId: 'break-glass-runtime',
            reason: 'break_glass_role_required'
        });
    };
}

function requirePrivilegedRuntimeReadAccess({ api = true } = {}) {
    return function privilegedRuntimeReadAccess(req, res, next) {
        if (canReadPrivilegedRuntime(req.user)) {
            return next();
        }

        return denyAccess(req, res, {
            api,
            message: 'Privileged runtime diagnostics require an admin session.',
            errors: ['Privileged runtime diagnostics require an admin session.'],
            actionId: 'read_privileged_runtime',
            resourceId: 'runtime-diagnostics',
            reason: 'admin_session_required'
        });
    };
}

function requirePrivilegedRuntimeMutationAccess({ api = true } = {}) {
    return function privilegedRuntimeMutationAccess(req, res, next) {
        if (canMutatePrivilegedRuntime(req.user)) {
            return next();
        }

        return denyAccess(req, res, {
            api,
            message: 'Privileged runtime changes require an admin session.',
            errors: ['Privileged runtime changes require an admin session.'],
            actionId: 'mutate_privileged_runtime',
            resourceId: 'runtime-configuration',
            reason: 'admin_session_required'
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

        return denyAccess(req, res, {
            api,
            message: 'A recent hardware-first MFA step-up is required for this privileged action.',
            errors: ['A recent hardware-first MFA step-up is required for this privileged action.'],
            actionId: 'perform_privileged_runtime_action',
            resourceId: 'hardware-step-up-window',
            reason: 'recent_hardware_step_up_required'
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
