function normalizeForwardedProto(value = '') {
    return String(value || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
}

function normalizeSocketAddress(address = '') {
    const trimmed = String(address || '').trim();
    if (!trimmed) {
        return '';
    }

    const withoutPrefix = trimmed.startsWith('::ffff:')
        ? trimmed.slice(7)
        : trimmed;

    if (withoutPrefix.startsWith('[') && withoutPrefix.includes(']')) {
        return withoutPrefix.slice(1, withoutPrefix.indexOf(']'));
    }

    const lastColon = withoutPrefix.lastIndexOf(':');
    if (lastColon > -1 && withoutPrefix.indexOf(':') === lastColon) {
        return withoutPrefix.slice(0, lastColon);
    }

    return withoutPrefix;
}

function isTrustedProxyAddress(address = '') {
    const normalized = normalizeSocketAddress(address);
    if (!normalized) {
        return false;
    }

    return normalized === '127.0.0.1'
        || normalized === '::1'
        || normalized === 'localhost'
        || normalized.startsWith('10.')
        || normalized.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
        || normalized.startsWith('fc')
        || normalized.startsWith('fd');
}

function requestArrivedFromTrustedProxy(req = {}, transport = {}) {
    if (!transport || !transport.proxyTlsTerminated) {
        return false;
    }

    const remoteAddress = req.socket && req.socket.remoteAddress
        ? req.socket.remoteAddress
        : (req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : '');

    return isTrustedProxyAddress(remoteAddress);
}

function requestUsesSecureTransport(req = {}, transport = {}) {
    if (req.secure) {
        return Boolean(
            (req.socket && req.socket.encrypted)
            || requestArrivedFromTrustedProxy(req, transport)
        );
    }

    if (req.socket && req.socket.encrypted) {
        return true;
    }

    if (
        requestArrivedFromTrustedProxy(req, transport)
        && typeof req.get === 'function'
        && normalizeForwardedProto(req.get('x-forwarded-proto')) === 'https'
    ) {
        return true;
    }

    return false;
}

function isApiStyleRequest(pathname = '') {
    const normalizedPath = String(pathname || '').split('?')[0].trim();
    return normalizedPath === '/healthz'
        || normalizedPath === '/metrics'
        || normalizedPath.startsWith('/api/');
}

function buildSecureRedirectTarget(req = {}) {
    const appBaseUrl = req.app && req.app.locals ? String(req.app.locals.appBaseUrl || '') : '';
    const originalUrl = String(req.originalUrl || req.url || '/');

    if (!appBaseUrl || !appBaseUrl.startsWith('https://')) {
        return '';
    }

    return `${appBaseUrl}${originalUrl}`;
}

function enforceSecureTransport(req, res, next) {
    const transport = req.app && req.app.locals ? req.app.locals.transportSecurity || {} : {};
    if (!transport.secureTransportRequired) {
        return next();
    }

    if (requestUsesSecureTransport(req, transport)) {
        return next();
    }

    const pathname = String(req.originalUrl || req.path || '/');
    const redirectTarget = buildSecureRedirectTarget(req);
    if (!isApiStyleRequest(pathname) && redirectTarget && ['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())) {
        return res.redirect(308, redirectTarget);
    }

    if (isApiStyleRequest(pathname)) {
        return res.status(400).json({
            success: false,
            message: 'HTTPS is required in this environment',
            errors: ['Protected runtime requests must arrive over HTTPS or a trusted TLS-terminating proxy.']
        });
    }

    return res.status(400).type('text/plain').send('HTTPS is required in this environment.');
}

module.exports = {
    buildSecureRedirectTarget,
    enforceSecureTransport,
    requestUsesSecureTransport
};
