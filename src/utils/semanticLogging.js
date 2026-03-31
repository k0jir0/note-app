const { isProtectedApiPath, normalizeAccessPath } = require('../services/apiAccessControlService');
const { getRequestContext, getRequestContextIdentifiers } = require('./requestContext');

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIp(req = {}) {
    const forwardedFor = req.headers && req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }

    return req.ip || (req.socket && req.socket.remoteAddress) || '';
}

function describeActorSubject(actor = {}) {
    if (actor.type === 'user') {
        return `User ${actor.userId || actor.email || actor.displayName || 'unknown-user'}`;
    }

    if (actor.type === 'anonymous') {
        return 'Anonymous request';
    }

    return 'System actor';
}

function resolveActor(req = {}) {
    if (req && req.user) {
        const accessProfile = req.user.accessProfile && typeof req.user.accessProfile === 'object'
            ? req.user.accessProfile
            : {};

        return {
            type: 'user',
            userId: req.user._id != null ? String(req.user._id) : '',
            email: String(req.user.email || ''),
            displayName: String(req.user.name || req.user.email || req.user._id || 'Current user'),
            missionRole: String(accessProfile.missionRole || '').trim().toLowerCase()
        };
    }

    return {
        type: 'anonymous',
        userId: '',
        email: '',
        displayName: 'Anonymous request',
        missionRole: ''
    };
}

function resolveAuthContext(req = {}) {
    if (!req || !req.user) {
        return {
            method: 'anonymous',
            label: 'an anonymous request',
            assurance: 'none',
            hardwareFirst: false,
            credential: ''
        };
    }

    const accessProfile = req.user.accessProfile && typeof req.user.accessProfile === 'object'
        ? req.user.accessProfile
        : {};
    const method = String(accessProfile.mfaMethod || '').trim().toLowerCase();
    const assurance = String(accessProfile.mfaAssurance || 'password_only').trim().toLowerCase() || 'password_only';
    const credential = String(
        accessProfile.hardwareTokenLabel
        || accessProfile.pkiCertificateSubject
        || accessProfile.hardwareTokenSerial
        || ''
    ).trim();

    if (method === 'hardware_token') {
        return {
            method,
            label: credential ? `hardware token ${credential}` : 'a hardware token',
            assurance,
            hardwareFirst: true,
            credential
        };
    }

    if (method === 'pki_certificate') {
        return {
            method,
            label: credential ? `PKI certificate ${credential}` : 'a PKI certificate',
            assurance,
            hardwareFirst: true,
            credential
        };
    }

    return {
        method: method || 'session_password',
        label: 'a password-authenticated session',
        assurance,
        hardwareFirst: Boolean(accessProfile.mfaHardwareFirst),
        credential
    };
}

function buildAuditLocation(req = {}, contextIdentifiers = getRequestContextIdentifiers()) {
    return {
        channel: 'http',
        requestId: contextIdentifiers.requestId || '',
        correlationId: contextIdentifiers.correlationId || '',
        method: String(req.method || 'GET').toUpperCase(),
        path: normalizeAccessPath(req.originalUrl || req.path || ''),
        ip: normalizeIp(req),
        userAgent: typeof req.get === 'function' ? String(req.get('user-agent') || '') : ''
    };
}

function buildFallbackRequestSemantics(req, res, actor, authContext, path, statusCode) {
    const outcome = statusCode >= 400 ? 'error' : 'completed';
    return {
        outcome,
        message: `${describeActorSubject(actor)} completed ${String(req.method || 'GET').toUpperCase()} ${path} via ${authContext.label} with status ${statusCode}.`,
        what: {
            intent: 'http-request',
            action: String(req.method || 'GET').toUpperCase(),
            resource: path,
            decision: outcome,
            statusCode
        }
    };
}

function buildMissionAccessSemantics(req, res, actor, authContext, statusCode) {
    const decision = req.missionAccessDecision;
    if (!decision) {
        return null;
    }

    const allowed = Boolean(decision.allowed) && statusCode < 400;
    const failedChecks = Array.isArray(decision.failedChecks)
        ? decision.failedChecks.map((check) => check.label || check.id || check.detail).filter(Boolean)
        : [];
    const actionLabel = String((decision.action && decision.action.label) || (decision.action && decision.action.id) || 'perform the requested mission action').trim();
    const resourceTitle = String((decision.resource && decision.resource.title) || (decision.resource && decision.resource.id) || 'the requested resource').trim();

    return {
        outcome: allowed ? 'authorized' : 'denied',
        message: allowed
            ? `${describeActorSubject(actor)} authorized to ${actionLabel.toLowerCase()} on ${resourceTitle} via ${authContext.label}.`
            : `${describeActorSubject(actor)} denied ${actionLabel.toLowerCase()} on ${resourceTitle}; failed checks: ${failedChecks.join(', ') || 'policy evaluation failed'}.`,
        what: {
            intent: 'mission-access',
            decision: allowed ? 'allow' : 'deny',
            actionId: decision.action && decision.action.id ? decision.action.id : '',
            actionLabel,
            resourceId: decision.resource && decision.resource.id ? decision.resource.id : '',
            resourceTitle,
            failedChecks,
            summary: decision.summary || ''
        }
    };
}

function buildBreakGlassSemantics(req, actor, authContext, statusCode) {
    const path = normalizeAccessPath(req.originalUrl || req.path || '');
    if (path !== '/api/runtime/break-glass') {
        return null;
    }

    const requestedMode = req.body && req.body.mode ? String(req.body.mode).trim().toLowerCase() : '';
    const requestedReason = req.body && typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    const breakGlass = req.app && req.app.locals ? req.app.locals.breakGlass : null;

    if (String(req.method || 'GET').toUpperCase() === 'GET') {
        return {
            outcome: statusCode >= 400 ? 'denied' : 'authorized',
            message: statusCode >= 400
                ? `${describeActorSubject(actor)} denied inspection of break-glass runtime state.`
                : `${describeActorSubject(actor)} inspected break-glass runtime state via ${authContext.label}.`,
            what: {
                intent: 'break-glass-control',
                action: 'inspect_break_glass_state',
                appliedMode: breakGlass && breakGlass.mode ? breakGlass.mode : '',
                decision: statusCode >= 400 ? 'deny' : 'allow'
            }
        };
    }

    return {
        outcome: statusCode >= 400 ? 'denied' : 'changed',
        message: statusCode >= 400
            ? `${describeActorSubject(actor)} failed to change break-glass mode to ${requestedMode || 'an unknown mode'}.`
            : `${describeActorSubject(actor)} changed break-glass mode to ${(breakGlass && breakGlass.mode) || requestedMode || 'unknown'} via ${authContext.label}.`,
        what: {
            intent: 'break-glass-control',
            action: 'update_break_glass_mode',
            requestedMode,
            requestedReason,
            appliedMode: breakGlass && breakGlass.mode ? breakGlass.mode : '',
            appliedReason: breakGlass && breakGlass.reason ? breakGlass.reason : requestedReason,
            decision: statusCode >= 400 ? 'deny' : 'allow'
        }
    };
}

function buildProtectedApiSemantics(req, actor, path, statusCode) {
    if (!(statusCode === 401 && isProtectedApiPath(path))) {
        return null;
    }

    return {
        outcome: 'denied',
        message: `${describeActorSubject(actor)} denied access to protected API ${path} because no verified identity was present.`,
        what: {
            intent: 'protected-api-access',
            action: String(req.method || 'GET').toUpperCase(),
            resource: path,
            decision: 'deny',
            statusCode
        }
    };
}

function buildRequestAuditEntry(req = {}, res = {}, durationMs = 0) {
    const contextIdentifiers = getRequestContextIdentifiers();
    const actor = resolveActor(req);
    const authContext = resolveAuthContext(req);
    const path = normalizeAccessPath(req.originalUrl || req.path || '');
    const statusCode = Number.isFinite(res.statusCode) ? res.statusCode : 200;
    const semantics = buildMissionAccessSemantics(req, res, actor, authContext, statusCode)
        || buildBreakGlassSemantics(req, actor, authContext, statusCode)
        || buildProtectedApiSemantics(req, actor, path, statusCode)
        || buildFallbackRequestSemantics(req, res, actor, authContext, path, statusCode);
    const where = buildAuditLocation(req, contextIdentifiers);

    return {
        message: semantics.message,
        metadata: {
            category: 'http-request',
            outcome: semantics.outcome,
            requestId: contextIdentifiers.requestId || '',
            correlationId: contextIdentifiers.correlationId || '',
            method: where.method,
            path: where.path,
            statusCode,
            durationMs,
            userId: actor.userId,
            ip: where.ip,
            userAgent: where.userAgent,
            who: actor,
            what: semantics.what,
            where,
            how: {
                mechanism: 'http-request',
                authMethod: authContext.method,
                authLabel: authContext.label,
                authAssurance: authContext.assurance,
                credential: authContext.credential,
                hardwareFirst: authContext.hardwareFirst,
                missionRole: actor.missionRole,
                semanticVersion: 1
            }
        }
    };
}

function buildDatabaseTelemetryMessage(event = {}) {
    const actor = describeActorSubject(event.who || {});
    const action = String(event.what && event.what.action ? event.what.action : 'change').trim().toLowerCase();
    const model = String(event.what && event.what.model ? event.what.model : 'record').trim();
    const documentId = String(event.what && event.what.documentId ? event.what.documentId : '').trim();
    const mechanism = String(event.how && event.how.mechanism ? event.how.mechanism : 'database telemetry').trim();
    const target = documentId ? `${model} ${documentId}` : model;

    if (action === 'create') {
        return `${actor} created ${target} via ${mechanism}.`;
    }

    if (action === 'delete') {
        return `${actor} deleted ${target} via ${mechanism}.`;
    }

    if (action === 'update') {
        return `${actor} updated ${target} via ${mechanism}.`;
    }

    return `${actor} recorded ${action} on ${target} via ${mechanism}.`;
}

function enrichMetadataWithRequestContext(metadata = {}) {
    if (!isPlainObject(metadata)) {
        return metadata;
    }

    const context = getRequestContext();
    if (!context) {
        return metadata;
    }

    const enriched = {
        ...metadata
    };

    if (!enriched.requestId && context.requestId) {
        enriched.requestId = context.requestId;
    }

    if (!enriched.correlationId && (context.correlationId || context.requestId)) {
        enriched.correlationId = context.correlationId || context.requestId;
    }

    if (isPlainObject(enriched.where)) {
        enriched.where = {
            ...enriched.where,
            requestId: enriched.where.requestId || context.requestId || '',
            correlationId: enriched.where.correlationId || context.correlationId || context.requestId || ''
        };
    }

    return enriched;
}

module.exports = {
    buildAuditLocation,
    buildDatabaseTelemetryMessage,
    buildRequestAuditEntry,
    enrichMetadataWithRequestContext,
    normalizeIp,
    resolveActor,
    resolveAuthContext
};