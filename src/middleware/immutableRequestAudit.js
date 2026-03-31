const { buildRequestAuditEntry } = require('../utils/semanticLogging');

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

            const entry = buildRequestAuditEntry(req, res, Date.now() - startedAt);
            void Promise.resolve(client.audit(entry.message, entry.metadata)).catch(() => {});
        });

        return next();
    };
}

module.exports = {
    createImmutableRequestAuditMiddleware
};
