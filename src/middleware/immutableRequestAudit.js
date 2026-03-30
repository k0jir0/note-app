function normalizeIp(req = {}) {
    const forwardedFor = req.headers && req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }

    return req.ip || (req.socket && req.socket.remoteAddress) || '';
}

function shouldAuditRequest(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.originalUrl || '');

    if (res.statusCode >= 400) {
        return true;
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return true;
    }

    return path.startsWith('/auth')
        || path.startsWith('/api/')
        || path.startsWith('/security')
        || path.startsWith('/seed');
}

function createImmutableRequestAuditMiddleware({ client } = {}) {
    return function immutableRequestAudit(req, res, next) {
        if (!client || !client.enabled) {
            return next();
        }

        const startedAt = Date.now();

        res.on('finish', () => {
            if (!shouldAuditRequest(req, res)) {
                return;
            }

            void client.audit('HTTP request completed', {
                category: 'http-request',
                method: String(req.method || 'GET').toUpperCase(),
                path: String(req.path || req.originalUrl || ''),
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
                userId: req.user && req.user._id ? String(req.user._id) : '',
                ip: normalizeIp(req),
                userAgent: typeof req.get === 'function' ? String(req.get('user-agent') || '') : ''
            });
        });

        return next();
    };
}

module.exports = {
    createImmutableRequestAuditMiddleware
};
