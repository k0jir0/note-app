const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const requestContextStorage = new AsyncLocalStorage();

function generateRequestId() {
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');
}

function readHeader(req, headerName) {
    if (!req || !headerName) {
        return '';
    }

    if (typeof req.get === 'function') {
        const value = req.get(headerName);
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    const headers = req.headers && typeof req.headers === 'object' ? req.headers : {};
    const directValue = headers[headerName] || headers[String(headerName).toLowerCase()];
    if (Array.isArray(directValue)) {
        return directValue.length ? String(directValue[0] || '').trim() : '';
    }

    return typeof directValue === 'string' ? directValue.trim() : '';
}

function createRequestContext(req) {
    const requestId = generateRequestId();
    const correlationId = readHeader(req, 'x-correlation-id')
        || readHeader(req, 'x-request-id')
        || requestId;

    return {
        requestId,
        correlationId,
        startedAt: new Date().toISOString(),
        req
    };
}

function requestContextMiddleware(req, res, next) {
    const context = createRequestContext(req);

    req.requestId = context.requestId;
    req.correlationId = context.correlationId;

    if (res && typeof res.setHeader === 'function') {
        res.setHeader('X-Request-Id', context.requestId);
        res.setHeader('X-Correlation-Id', context.correlationId);
    }

    requestContextStorage.run(context, next);
}

function getRequestContext() {
    return requestContextStorage.getStore() || null;
}

function getRequestContextIdentifiers() {
    const context = getRequestContext();
    if (!context) {
        return {
            requestId: '',
            correlationId: ''
        };
    }

    return {
        requestId: context.requestId || '',
        correlationId: context.correlationId || context.requestId || ''
    };
}

module.exports = {
    createRequestContext,
    getRequestContext,
    getRequestContextIdentifiers,
    requestContextMiddleware
};
