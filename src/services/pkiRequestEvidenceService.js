const { isTrustedProxyAddress } = require('./trustedProxyService');

function normalizeDistinguishedName(input) {
    if (!input) {
        return '';
    }

    if (typeof input === 'string') {
        return input
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .join(', ');
    }

    if (typeof input === 'object') {
        return Object.entries(input)
            .filter(([, value]) => String(value || '').trim())
            .map(([key, value]) => `${key}=${String(value).trim()}`)
            .join(', ');
    }

    return '';
}

function isTrustedProxyHeaderModeEnabled() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.TRUST_PROXY_CLIENT_CERT_HEADERS || '').trim().toLowerCase() === 'true';
}

function readHeader(req = {}, name = '') {
    if (!name) {
        return '';
    }

    if (typeof req.get === 'function') {
        return String(req.get(name) || '').trim();
    }

    const headers = req.headers && typeof req.headers === 'object'
        ? req.headers
        : {};

    return String(headers[String(name).toLowerCase()] || headers[name] || '').trim();
}

function readTrustedProxyAddresses(req = {}) {
    const transportSecurity = req.app && req.app.locals
        ? req.app.locals.transportSecurity
        : null;

    return Array.isArray(transportSecurity && transportSecurity.trustedProxyAddresses)
        ? transportSecurity.trustedProxyAddresses
        : [];
}

function hasTrustedProxyContext(req = {}) {
    const appTrustProxy = req.app && typeof req.app.get === 'function'
        ? req.app.get('trust proxy')
        : null;
    const forwardedChainPresent = Boolean(
        readHeader(req, 'x-forwarded-for')
        || readHeader(req, 'x-forwarded-host')
        || readHeader(req, 'x-forwarded-proto')
        || (Array.isArray(req.ips) && req.ips.length)
    );
    const proxySentinel = readHeader(req, 'x-client-cert-proxy-verified').toLowerCase();
    const proxyMarkedRequest = ['1', 'true', 'verified'].includes(proxySentinel);
    const trustProxyEnabled = Boolean(appTrustProxy)
        || (process.env.NODE_ENV === 'test' && forwardedChainPresent);
    const remoteAddress = req.socket && req.socket.remoteAddress
        ? req.socket.remoteAddress
        : (req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : '');

    return trustProxyEnabled
        && proxyMarkedRequest
        && forwardedChainPresent
        && isTrustedProxyAddress(remoteAddress, readTrustedProxyAddresses(req));
}

function extractPeerCertificateEvidence(req = {}) {
    const socket = req.socket || req.connection;
    if (!socket || typeof socket.getPeerCertificate !== 'function') {
        return null;
    }

    const certificate = socket.getPeerCertificate(true);
    if (!certificate || (!certificate.subject && !certificate.subjectaltname)) {
        return null;
    }

    if (socket.authorized !== true) {
        return null;
    }

    const subject = normalizeDistinguishedName(certificate.subject);
    const issuer = normalizeDistinguishedName(certificate.issuer);
    const verified = Boolean(subject);

    if (!verified) {
        return null;
    }

    return {
        verified: true,
        source: 'peer-certificate',
        subject,
        issuer,
        fingerprint256: String(certificate.fingerprint256 || '').trim()
    };
}

function extractProxyHeaderEvidence(req = {}) {
    if (!isTrustedProxyHeaderModeEnabled() || !hasTrustedProxyContext(req)) {
        return null;
    }

    const verifiedHeader = readHeader(req, 'x-client-cert-verified').toLowerCase();
    const verified = ['success', 'true', '1', 'verified'].includes(verifiedHeader);
    const subject = normalizeDistinguishedName(readHeader(req, 'x-client-cert-subject'));
    const issuer = normalizeDistinguishedName(readHeader(req, 'x-client-cert-issuer'));

    if (!verified || !subject) {
        return null;
    }

    return {
        verified: true,
        source: 'trusted-proxy-header',
        subject,
        issuer,
        fingerprint256: readHeader(req, 'x-client-cert-fingerprint')
    };
}

function extractClientCertificateEvidence(req = {}) {
    return extractPeerCertificateEvidence(req) || extractProxyHeaderEvidence(req) || null;
}

module.exports = {
    extractClientCertificateEvidence,
    normalizeDistinguishedName
};
