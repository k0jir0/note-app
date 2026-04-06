const crypto = require('crypto');

const { canReadPrivilegedRuntime } = require('./privilegedRuntimeAccessService');

function readOperationalDiagnosticsToken() {
    const value = String(process.env.METRICS_AUTH_TOKEN || '').trim();
    return value.length > 0 ? value : '';
}

function extractOperationalDiagnosticsToken(req = {}) {
    const headers = req && req.headers && typeof req.headers === 'object'
        ? req.headers
        : {};
    const headerValue = headers.authorization || headers.Authorization || headers['x-metrics-token'] || '';

    if (typeof headerValue !== 'string') {
        return '';
    }

    const trimmedValue = headerValue.trim();
    const bearerPrefix = 'Bearer ';
    if (trimmedValue.startsWith(bearerPrefix)) {
        return trimmedValue.slice(bearerPrefix.length).trim();
    }

    return trimmedValue;
}

function isAuthenticatedPrivilegedSession(req = {}) {
    return Boolean(
        req
        && typeof req.isAuthenticated === 'function'
        && req.isAuthenticated()
        && req.user
        && req.user._id
        && canReadPrivilegedRuntime(req.user)
    );
}

function hasValidOperationalDiagnosticsToken(req = {}) {
    const expectedToken = readOperationalDiagnosticsToken();
    const presentedToken = extractOperationalDiagnosticsToken(req);

    if (!expectedToken || !presentedToken) {
        return false;
    }

    const expectedBuffer = Buffer.from(expectedToken, 'utf8');
    const presentedBuffer = Buffer.from(presentedToken, 'utf8');
    if (expectedBuffer.length !== presentedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
}

function canReadOperationalDiagnostics(req = {}) {
    return isAuthenticatedPrivilegedSession(req) || hasValidOperationalDiagnosticsToken(req);
}

module.exports = {
    canReadOperationalDiagnostics,
    extractOperationalDiagnosticsToken,
    hasValidOperationalDiagnosticsToken,
    isAuthenticatedPrivilegedSession,
    readOperationalDiagnosticsToken
};
