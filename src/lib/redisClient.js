const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || '';

function makeNoopClient(name = 'noop') {
    const noop = async () => null;
    const client = {
        xadd: async () => null,
        xack: async () => null,
        xreadgroup: async () => null,
        xgroup: async () => null,
        xlen: async () => 0,
        publish: async () => 0,
        subscribe: async () => null,
        unsubscribe: async () => null,
        on: () => {},
        removeListener: () => {},
        quit: async () => null,
        disconnect: () => {}
    };
    return client;
}

// If REDIS_URL is not provided or tests are running, return noop clients to avoid
// unhandled connection errors during local tests or CI where Redis may not run.
if (!REDIS_URL || process.env.NODE_ENV === 'test' || process.env.DISABLE_REDIS === '1') {
    const redis = makeNoopClient('redis');
    const publisher = makeNoopClient('publisher');
    const subscriber = makeNoopClient('subscriber');
    module.exports = { redis, publisher, subscriber };
} else {
    // Create real clients and attach safe error handlers so failures don't crash the process
    const redis = new Redis(REDIS_URL);
    const publisher = new Redis(REDIS_URL);
    const subscriber = new Redis(REDIS_URL);

    const onError = (label) => (err) => {
        // Log but don't throw; calling code should handle absence of Redis results
        // eslint-disable-next-line no-console
        console.warn(`[redis:${label}] error`, err && err.message ? err.message : err);
    };

    redis.on('error', onError('client'));
    publisher.on('error', onError('publisher'));
    subscriber.on('error', onError('subscriber'));

    module.exports = { redis, publisher, subscriber };
}
