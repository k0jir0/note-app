const mongoose = require('mongoose');
const { redis, publisher } = require('../lib/redisClient');
const SecurityAlert = require('../models/SecurityAlert');
const { analyzeLogText } = require('../utils/logAnalysis');
const { sendBlockRequestsForAlerts } = require('../services/blockingService');
const { workerPendingGauge } = require('../routes/metrics');

const STREAM_KEY = 'security:ingest';
const GROUP = 'realtime-group';
const CONSUMER = `consumer-${process.pid}`;

const REDIS_CREATE_GROUP = async () => {
    try {
        await redis.xgroup('CREATE', STREAM_KEY, GROUP, '$', 'MKSTREAM');
        console.log('[realtime-worker] created consumer group');
    } catch (err) {
        // BUSYGROUP means group already exists
        if (!/BUSYGROUP/.test(String(err))) {
            console.error('[realtime-worker] error creating group', err);
        }
    }
};

async function handleMessage(id, fields) {
    try {
        const raw = fields.payload || '';
        const message = JSON.parse(raw);
        if (message.type === 'log' && message.logText) {
            const analysis = analyzeLogText(message.logText);
            const alertsToCreate = analysis.alerts.map((alert) => ({
                ...alert,
                user: mongoose.Types.ObjectId(message.user),
                source: 'realtime-ingest',
                detectedAt: new Date()
            }));

            let saved = [];
            if (alertsToCreate.length > 0) {
                saved = await SecurityAlert.insertMany(alertsToCreate);
            }

            // Publish created alerts for SSE/clients per-user
            if (saved.length > 0) {
                // group saved alerts by user
                const byUser = saved.reduce((acc, doc) => {
                    const uid = String(doc.user || (doc.user === 0 ? '0' : 'global'));
                    if (!acc[uid]) acc[uid] = [];
                    acc[uid].push(doc);
                    return acc;
                }, {});

                for (const uid of Object.keys(byUser)) {
                    const channel = `security:events:${uid}`;
                    await publisher.publish(channel, JSON.stringify({ type: 'alerts', created: byUser[uid].length, alerts: byUser[uid] }));
                }
                // also publish to global channel for operators
                await publisher.publish('security:events:global', JSON.stringify({ type: 'alerts', created: saved.length, alerts: saved }));
            }

            // Active blocking: send block webhook for high-severity alerts (best-effort)
            try {
                const highAlerts = saved.filter((a) => (a.severity === 'high'));
                if (highAlerts.length > 0) {
                    // saved documents may be mongoose documents; convert to plain objects
                    const plain = highAlerts.map((d) => (d.toObject ? d.toObject() : d));
                    const blockResults = await sendBlockRequestsForAlerts(plain);
                    console.log('[realtime-worker] block results', blockResults);
                }
            } catch (e) {
                console.error('[realtime-worker] active block error', e);
            }
        } else {
            // For non-log types, publish to user's channel if present else global
            const targetUser = message.user ? String(message.user) : 'global';
            const channel = `security:events:${targetUser}`;
            await publisher.publish(channel, JSON.stringify({ type: 'ingest', payload: message }));
        }

        // Acknowledge the message
        await redis.xack(STREAM_KEY, GROUP, id);
    } catch (err) {
        console.error('[realtime-worker] handleMessage error', err);
    }
}

async function loop() {
    /* eslint-disable no-constant-condition */
    while (true) {
        try {
            const resp = await redis.xreadgroup('GROUP', GROUP, CONSUMER, 'BLOCK', 5000, 'COUNT', 10, 'STREAMS', STREAM_KEY, '>');
            if (!resp) continue;

            for (const [, messages] of resp) {
                for (const [id, pairs] of messages) {
                    // pairs is array [key1, val1, key2, val2]
                    const fields = {};
                    for (let i = 0; i < pairs.length; i += 2) {
                        fields[pairs[i]] = pairs[i + 1];
                    }
                    await handleMessage(id, fields);
                }
            }
        } catch (err) {
            console.error('[realtime-worker] loop error', err);
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    /* eslint-enable no-constant-condition */
}

async function start() {
    if (!process.env.REDIS_URL || process.env.DISABLE_REDIS === '1') {
        console.error('[realtime-worker] REDIS_URL is required to run the realtime worker');
        process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/note-app';
    try {
        await mongoose.connect(mongoUri, { /* useUnifiedTopology: true, useNewUrlParser: true */ });
        console.log('[realtime-worker] connected to mongo');
    } catch (e) {
        console.error('[realtime-worker] mongo connect failed', e);
        process.exit(1);
    }

    await REDIS_CREATE_GROUP();
    // Periodically update pending gauge
    setInterval(async () => {
        try {
            const len = await redis.xlen(STREAM_KEY);
            if (typeof workerPendingGauge.set === 'function') workerPendingGauge.set(len);
        } catch (e) {
            // ignore
        }
    }, 5000);
    console.log('[realtime-worker] starting main loop');
    loop();
}

start();
