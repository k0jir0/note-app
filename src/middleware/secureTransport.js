const { isTrustedProxyAddress } = require('../services/trustedProxyService');

function normalizeForwardedProto(value = '') {
    return String(value || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
}

function requestArrivedFromTrustedProxy(req = {}, transport = {}) {
    if (!transport || !transport.proxyTlsTerminated) {
        return false;
    }

    const remoteAddress = req.socket && req.socket.remoteAddress
        ? req.socket.remoteAddress
        : (req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : '');

    return isTrustedProxyAddress(remoteAddress, transport.trustedProxyAddresses);
}

function requestUsesTrustedProxyTlsTermination(req = {}, transport = {}) {
    if (!transport || !transport.proxyTlsTerminated) {
        return false;
    }

    if (req.secure) {
        return true;
    }

    return requestArrivedFromTrustedProxy(req, transport)
        && typeof req.get === 'function'
        && normalizeForwardedProto(req.get('x-forwarded-proto')) === 'https';
}

function requestUsesSecureTransport(req = {}, transport = {}) {
    if (req.socket && req.socket.encrypted) {
        return true;
    }

    if (requestUsesTrustedProxyTlsTermination(req, transport)) {
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
