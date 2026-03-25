const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || '';

function shouldUseNoopRedis(env = process.env) {
    return !env.REDIS_URL || env.NODE_ENV === 'test' || env.DISABLE_REDIS === '1';
}

function createRedisOptions() {
    return {
        lazyConnect: true,
        connectTimeout: 2000,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
    };
}

function makeNoopClient() {
    return {
        xadd: async () => null,
        xack: async () => null,
        xreadgroup: async () => null,
        xautoclaim: async () => ['0-0', []],
        xgroup: async () => null,
        xlen: async () => 0,
        xpending: async () => [0],
        publish: async () => 0,
        subscribe: async () => null,
        unsubscribe: async () => null,
        on: () => {},
        removeListener: () => {},
        duplicate: () => makeNoopClient(),
        quit: async () => null,
        disconnect: () => {}
    };
}

// If REDIS_URL is not provided or tests are running, return noop clients to avoid
// unhandled connection errors during local tests or CI where Redis may not run.
if (shouldUseNoopRedis()) {
    const redis = makeNoopClient();
    const publisher = makeNoopClient();
    const subscriber = makeNoopClient();
    module.exports = {
        redis,
        publisher,
        subscriber,
        createRedisOptions,
        shouldUseNoopRedis
    };
} else {
    // Keep Redis lazy so optional realtime support does not spam startup logs when the
    // local service is down; commands still fail fast when Redis is actually used.
    const redis = new Redis(REDIS_URL, createRedisOptions());
    const publisher = new Redis(REDIS_URL, createRedisOptions());
    const subscriber = new Redis(REDIS_URL, createRedisOptions());

    const onError = (label) => (err) => {
        // Log but don't throw; calling code should handle absence of Redis results
        // eslint-disable-next-line no-console
        console.warn(`[redis:${label}] error`, err && err.message ? err.message : err);
    };

    redis.on('error', onError('client'));
    publisher.on('error', onError('publisher'));
    subscriber.on('error', onError('subscriber'));

    module.exports = {
        redis,
        publisher,
        subscriber,
        createRedisOptions,
        shouldUseNoopRedis
    };
}
