const { redis, subscriber } = require('../lib/redisClient');
const { ingestCounter } = require('../routes/metrics');

async function enqueueRealtimeIngest({ appLocals, userId, payload = {} }) {
    if (!appLocals || !appLocals.realtimeEnabled) {
        return {
            ok: false,
            status: 404,
            message: 'Realtime ingestion is disabled'
        };
    }

    const { type = 'log', logText = '', raw = '' } = payload;

    if (type === 'log' && typeof logText !== 'string') {
        return {
            ok: false,
            status: 400,
            errors: ['logText must be a string']
        };
    }

    const message = {
        type,
        user: String(userId),
        logText: type === 'log' ? logText : '',
        raw: raw || ''
    };

    await redis.xadd('security:ingest', '*', 'payload', JSON.stringify(message));

    try {
        ingestCounter.inc({ type });
    } catch (error) {
        void error;
    }

    return {
        ok: true,
        status: 202,
        message: 'Enqueued for real-time processing'
    };
}

async function respondToRealtimeProbe({ appLocals, query, res }) {
    if (!appLocals || !appLocals.realtimeEnabled) {
        return res.status(404).json({ success: false, message: 'Realtime endpoint disabled' });
    }

    if (query && query.probe === '1') {
        return res.status(200).json({ success: true, enabled: true });
    }

    return null;
}

function openRealtimeEventStream({ appLocals, userId, req, res }) {
    if (!appLocals || !appLocals.realtimeEnabled) {
        return res.status(404).json({ success: false, message: 'Realtime endpoint disabled' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const keepAlive = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 25000);

    const channel = `security:events:${String(userId || 'global')}`;
    const localSubscriber = typeof subscriber.duplicate === 'function'
        ? subscriber.duplicate()
        : subscriber;

    const onMessage = (resolvedChannel, message) => {
        if (resolvedChannel === channel) {
            try {
                send(JSON.parse(message));
            } catch (_error) {
                send({ error: 'malformed event' });
            }
        }
    };

    localSubscriber.subscribe(channel).then(() => {
        localSubscriber.on('message', onMessage);
    }).catch((error) => {
        void error;
    });

    req.on('close', () => {
        clearInterval(keepAlive);
        try {
            localSubscriber.removeListener('message', onMessage);
        } catch (error) {
            void error;
        }
        try {
            localSubscriber.unsubscribe(channel);
        } catch (error) {
            void error;
        }
        if (localSubscriber !== subscriber) {
            try {
                localSubscriber.quit();
            } catch (error) {
                void error;
            }
            try {
                localSubscriber.disconnect();
            } catch (error) {
                void error;
            }
        }
        res.end();
    });

    return res;
}

module.exports = {
    enqueueRealtimeIngest,
    openRealtimeEventStream,
    respondToRealtimeProbe
};
