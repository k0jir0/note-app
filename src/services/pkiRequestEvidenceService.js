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
    if (!isTrustedProxyHeaderModeEnabled() || typeof req.get !== 'function') {
        return null;
    }

    const verifiedHeader = String(req.get('x-client-cert-verified') || '').trim().toLowerCase();
    const verified = ['success', 'true', '1', 'verified'].includes(verifiedHeader);
    const subject = normalizeDistinguishedName(req.get('x-client-cert-subject'));
    const issuer = normalizeDistinguishedName(req.get('x-client-cert-issuer'));

    if (!verified || !subject) {
        return null;
    }

    return {
        verified: true,
        source: 'trusted-proxy-header',
        subject,
        issuer,
        fingerprint256: String(req.get('x-client-cert-fingerprint') || '').trim()
    };
}

function extractClientCertificateEvidence(req = {}) {
    return extractPeerCertificateEvidence(req) || extractProxyHeaderEvidence(req) || null;
}

module.exports = {
    extractClientCertificateEvidence,
    normalizeDistinguishedName
};
