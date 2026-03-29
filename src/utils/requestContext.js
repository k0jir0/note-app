const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const requestContextStorage = new AsyncLocalStorage();

function createRequestContext(req) {
    return {
        requestId: typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString('hex'),
        req
    };
}

function requestContextMiddleware(req, res, next) {
    requestContextStorage.run(createRequestContext(req), next);
}

function getRequestContext() {
    return requestContextStorage.getStore() || null;
}

module.exports = {
    getRequestContext,
    requestContextMiddleware
};
