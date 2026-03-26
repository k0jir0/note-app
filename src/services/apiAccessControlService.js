const PROTECTED_API_PATH_PREFIXES = ['/api/'];
const PROTECTED_API_PATHS = ['/__runtime-config', '/__realtime-status'];
const PUBLIC_API_PATHS = ['/__test/csrf'];

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
    );
}

function buildVerifiedIdentityContext(req) {
    return {
        userId: String(req.user._id),
        email: String(req.user.email || ''),
        method: String(req.method || 'GET').toUpperCase(),
        path: normalizeAccessPath(req.originalUrl || req.path || ''),
        verifiedAt: new Date().toISOString(),
        enforcement: 'server-side-api-access-control'
    };
}

module.exports = {
    buildVerifiedIdentityContext,
    hasVerifiedRequestIdentity,
    isProtectedApiPath,
    isPublicApiPath,
    listProtectedApiPathPrefixes,
    listProtectedApiPaths,
    listPublicApiPaths,
    normalizeAccessPath
};
