const PROTECTED_API_PATH_PREFIXES = ['/api/'];
const PROTECTED_API_PATHS = ['/__runtime-config', '/__realtime-status'];
const PUBLIC_API_PATHS = ['/__test/csrf'];
const { isAccountDisabled } = require('./accountLifecycleService');

const {
    canManageBreakGlassRuntime,
    canMutatePrivilegedRuntime,
    canReadPrivilegedRuntime,
    hasRecentHardwareStepUp
} = require('./privilegedRuntimeAccessService');

const SANITIZATION_BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function sanitizeString(value) {
    return String(value || '')
        .replaceAll('\0', '')
        .trim();
}

function sanitizeRequestValue(value, depth = 0) {
    if (depth > 12) {
        return null;
    }

    if (typeof value === 'string') {
        return sanitizeString(value);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeRequestValue(entry, depth + 1));
    }

    if (isPlainObject(value)) {
        return Object.entries(value).reduce((result, [key, nestedValue]) => {
            if (SANITIZATION_BLOCKED_KEYS.has(key)) {
                return result;
            }

            result[key] = sanitizeRequestValue(nestedValue, depth + 1);
            return result;
        }, {});
    }

    return value;
}

function setRequestSurface(req, key, value) {
    Object.defineProperty(req, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
    });

    return req[key];
}

function sanitizeRequestSurfaces(req = {}) {
    const body = sanitizeRequestValue(req.body);
    const query = sanitizeRequestValue(req.query);
    const params = sanitizeRequestValue(req.params);

    const sanitizedBody = isPlainObject(body) || Array.isArray(body) ? body : (body == null ? {} : body);
    const sanitizedQuery = isPlainObject(query) ? query : {};
    const sanitizedParams = isPlainObject(params) ? params : {};

    return {
        body: setRequestSurface(req, 'body', sanitizedBody),
        query: setRequestSurface(req, 'query', sanitizedQuery),
        params: setRequestSurface(req, 'params', sanitizedParams)
    };
}

function evaluateApiAccessPolicy(req = {}) {
    const path = normalizeAccessPath(req.originalUrl || req.path || '');
    const method = String(req.method || 'GET').toUpperCase();

    if (isPublicApiPath(path)) {
        return {
            allowed: true,
            policyId: 'public-api-access',
            requirement: 'public',
            reason: 'This API path is explicitly public.'
        };
    }

    if (!isProtectedApiPath(path)) {
        return {
            allowed: true,
            policyId: 'non-api-request',
            requirement: 'none',
            reason: 'This request is outside the protected API boundary.'
        };
    }

    if (!hasVerifiedRequestIdentity(req)) {
        return {
            allowed: false,
            policyId: 'authenticated-identity-required',
            requirement: 'verified_identity',
            reason: 'A verified authenticated identity is required for this API request.'
        };
    }

    if (path === '/api/runtime/break-glass') {
        const hasRequiredRole = canManageBreakGlassRuntime(req.user);
        const hasRecentStepUp = method === 'GET' || hasRecentHardwareStepUp(req.session);
        const allowed = hasRequiredRole && hasRecentStepUp;
        return {
            allowed,
            policyId: hasRequiredRole ? 'break-glass-control' : 'break-glass-role-required',
            requirement: method === 'GET'
                ? 'break_glass_operator'
                : 'break_glass_operator_with_recent_hardware_step_up',
            reason: allowed
                ? 'The current user is allowed to operate the break-glass runtime control.'
                : (hasRequiredRole
                    ? 'Break-glass runtime changes require a recent hardware-first MFA step-up.'
                    : 'Break-glass runtime control requires an admin or break_glass role.'),
            metadata: {
                method,
                path,
                missionRole: String(req.user && req.user.accessProfile && req.user.accessProfile.missionRole || '').trim().toLowerCase()
            }
        };
    }

    if (path === '/api/runtime/realtime') {
        const allowed = canMutatePrivilegedRuntime(req.user) && hasRecentHardwareStepUp(req.session);
        return {
            allowed,
            policyId: 'privileged-runtime-mutation',
            requirement: 'admin_with_recent_hardware_step_up',
            reason: allowed
                ? 'The current user is allowed to mutate privileged runtime controls.'
                : 'Privileged runtime changes require an admin session with recent hardware-first MFA.',
            metadata: {
                method,
                path
            }
        };
    }

    if (path === '/__runtime-config' || path === '/__realtime-status') {
        const allowed = canReadPrivilegedRuntime(req.user);
        return {
            allowed,
            policyId: 'privileged-runtime-read',
            requirement: 'admin',
            reason: allowed
                ? 'The current user is allowed to inspect privileged runtime diagnostics.'
                : 'Privileged runtime diagnostics require an admin session.',
            metadata: {
                method,
                path
            }
        };
    }

    return {
        allowed: true,
        policyId: 'authenticated-api-access',
        requirement: 'verified_identity',
        reason: 'Protected API requests require a verified authenticated identity.',
        metadata: {
            method,
            path,
            userId: req.user && req.user._id ? String(req.user._id) : ''
        }
    };
}

function normalizeAccessPath(pathname = '') {
    return String(pathname || '').split('?')[0].trim() || '/';
}

function listProtectedApiPathPrefixes() {
    return [...PROTECTED_API_PATH_PREFIXES];
}

function listProtectedApiPaths() {
    return [...PROTECTED_API_PATHS];
}

function listPublicApiPaths() {
    return [...PUBLIC_API_PATHS];
}

function isPublicApiPath(pathname = '') {
    const normalizedPath = normalizeAccessPath(pathname);
    return PUBLIC_API_PATHS.includes(normalizedPath);
}

function isProtectedApiPath(pathname = '') {
    const normalizedPath = normalizeAccessPath(pathname);

    if (isPublicApiPath(normalizedPath)) {
        return false;
    }

    return PROTECTED_API_PATHS.includes(normalizedPath)
        || PROTECTED_API_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

function hasVerifiedRequestIdentity(req) {
    return Boolean(
        req
        && typeof req.isAuthenticated === 'function'
        && req.isAuthenticated()
        && req.user
        && req.user._id
        && !isAccountDisabled(req.user)
    );
}

function buildVerifiedIdentityContext(req, authorization = null) {
    const resolvedAuthorization = authorization || evaluateApiAccessPolicy(req);

    return {
        userId: String(req.user._id),
        email: String(req.user.email || ''),
        method: String(req.method || 'GET').toUpperCase(),
        path: normalizeAccessPath(req.originalUrl || req.path || ''),
        verifiedAt: new Date().toISOString(),
        enforcement: 'server-side-api-access-control',
        authorization: {
            policyId: resolvedAuthorization.policyId,
            requirement: resolvedAuthorization.requirement,
            reason: resolvedAuthorization.reason,
            metadata: resolvedAuthorization.metadata || {}
        }
    };
}

module.exports = {
    buildVerifiedIdentityContext,
    evaluateApiAccessPolicy,
    hasVerifiedRequestIdentity,
    isProtectedApiPath,
    isPublicApiPath,
    listProtectedApiPathPrefixes,
    listProtectedApiPaths,
    listPublicApiPaths,
    normalizeAccessPath,
    sanitizeRequestSurfaces,
    sanitizeRequestValue
};
