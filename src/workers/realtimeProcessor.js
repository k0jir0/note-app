const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

const mongoose = require('mongoose');
const { redis, publisher } = require('../lib/redisClient');
const { workerPendingGauge } = require('../routes/metrics');
const { validateRuntimeConfig } = require('../config/runtimeConfig');
const { startAutomation } = require('../services/automationService');
const { persistLogAnalysis } = require('../services/securityIngestService');

const STREAM_KEY = 'security:ingest';
const DEAD_LETTER_STREAM_KEY = `${STREAM_KEY}:dead-letter`;
const GROUP = 'realtime-group';
const CONSUMER = `consumer-${process.pid}`;
const CLAIM_MIN_IDLE_MS = 60000;
const MESSAGE_BATCH_SIZE = 10;
const BLOCK_TIMEOUT_MS = 5000;
const LOOP_RETRY_DELAY_MS = 2000;
const METRICS_INTERVAL_MS = 5000;

function parseStreamFields(pairs = []) {
    const fields = {};

    for (let i = 0; i < pairs.length; i += 2) {
        fields[pairs[i]] = pairs[i + 1];
    }

    return fields;
}

function normalizeStreamMessages(messages = []) {
    return messages.map(([id, pairs]) => ({
        id,
        fields: parseStreamFields(pairs)
    }));
}

function extractPendingCount(summary) {
    if (typeof summary === 'number') {
        return summary;
    }

    if (Array.isArray(summary) && summary.length > 0) {
        const parsed = Number.parseInt(summary[0], 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

function logInfo(logger, ...args) {
    if (logger && typeof logger.log === 'function') {
        logger.log(...args);
        return;
    }

    console.log(...args);
}

function logError(logger, ...args) {
    if (logger && typeof logger.error === 'function') {
        logger.error(...args);
        return;
    }

    console.error(...args);
}

function normalizeWorkerEnv(env = process.env) {
    if (env.MONGODB_URI || !env.MONGO_URI) {
        return env;
    }

    return {
        ...env,
        MONGODB_URI: env.MONGO_URI
    };
}

function hasEnabledAutomation(automationConfig = {}) {
    return Boolean(
        (automationConfig.logBatch && automationConfig.logBatch.enabled)
        || (automationConfig.scanBatch && automationConfig.scanBatch.enabled)
        || (automationConfig.intrusionBatch && automationConfig.intrusionBatch.enabled)
    );
}

function isRealtimeConfigured(env = process.env) {
    return Boolean(env.REDIS_URL) && env.ENABLE_REALTIME === '1' && env.DISABLE_REDIS !== '1';
}

async function createConsumerGroup({
    redisClient = redis,
    streamKey = STREAM_KEY,
    group = GROUP,
    logger = console
} = {}) {
    try {
        await redisClient.xgroup('CREATE', streamKey, group, '$', 'MKSTREAM');
        logInfo(logger, '[realtime-worker] created consumer group');
    } catch (err) {
        // BUSYGROUP means group already exists
        if (!/BUSYGROUP/.test(String(err))) {
            logError(logger, '[realtime-worker] error creating group', err);
        }
    }
}

async function ackMessage({
    redisClient = redis,
    streamKey = STREAM_KEY,
    group = GROUP,
    id,
    logger = console
}) {
    try {
        await redisClient.xack(streamKey, group, id);
        return true;
    } catch (error) {
        logError(logger, '[realtime-worker] xack failed', error);
        return false;
    }
}

async function deadLetterMessage({
    redisClient = redis,
    streamKey = STREAM_KEY,
    deadLetterKey = DEAD_LETTER_STREAM_KEY,
    group = GROUP,
    id,
    fields,
    error,
    logger = console
}) {
    try {
        await redisClient.xadd(
            deadLetterKey,
            '*',
            'sourceStream',
            streamKey,
            'group',
            group,
            'originalId',
            id,
            'payload',
            fields && typeof fields.payload === 'string' ? fields.payload : '',
            'error',
            error && error.message ? error.message : String(error),
            'failedAt',
            new Date().toISOString()
        );
    } catch (deadLetterError) {
        logError(logger, '[realtime-worker] dead-letter publish error', deadLetterError);
    }

    await ackMessage({ redisClient, streamKey, group, id, logger });
}

async function handleMessage(id, fields, options = {}) {
    const redisClient = options.redisClient || redis;
    const publisherClient = options.publisherClient || publisher;
    const mongooseLib = options.mongooseLib || mongoose;
    const logger = options.logger || console;
    const persistLogAnalysisFn = options.persistLogAnalysisFn || persistLogAnalysis;
    const streamKey = options.streamKey || STREAM_KEY;
    const deadLetterKey = options.deadLetterKey || DEAD_LETTER_STREAM_KEY;
    const group = options.group || GROUP;

    try {
        const raw = fields.payload || '';
        const message = JSON.parse(raw);
        if (message.type === 'log' && message.logText) {
            const result = await persistLogAnalysisFn({
                userId: new mongooseLib.Types.ObjectId(message.user),
                source: 'realtime-ingest',
                logText: message.logText,
                dedupeWindowMs: 0,
                respondToIncidents: true,
                detectedAt: new Date()
            }, {
                SecurityAlertModel: options.SecurityAlertModel,
                analyzeLogTextFn: options.analyzeLogTextFn,
                executeIncidentResponsesFn: options.executeIncidentResponsesFn
            });
            const saved = Array.isArray(result.alerts) ? result.alerts : [];

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
                    await publisherClient.publish(channel, JSON.stringify({ type: 'alerts', created: byUser[uid].length, alerts: byUser[uid] }));
                }
                // also publish to global channel for operators
                await publisherClient.publish('security:events:global', JSON.stringify({ type: 'alerts', created: saved.length, alerts: saved }));
            }
        } else {
            // For non-log types, publish to user's channel if present else global
            const targetUser = message.user ? String(message.user) : 'global';
            const channel = `security:events:${targetUser}`;
            await publisherClient.publish(channel, JSON.stringify({ type: 'ingest', payload: message }));
        }

        // Acknowledge the message
        await ackMessage({ redisClient, streamKey, group, id, logger });
        return { success: true };
    } catch (err) {
        logError(logger, '[realtime-worker] handleMessage error', err);
        await deadLetterMessage({
            redisClient,
            streamKey,
            deadLetterKey,
            group,
            id,
            fields,
            error: err,
            logger
        });
        return { success: false, deadLettered: true, error: err };
    }
}

async function processStreamMessages(messages = [], options = {}) {
    for (const message of messages) {
        await handleMessage(message.id, message.fields, options);
    }
}

async function claimStaleMessages({
    redisClient = redis,
    streamKey = STREAM_KEY,
    group = GROUP,
    consumer = CONSUMER,
    minIdleMs = CLAIM_MIN_IDLE_MS,
    count = MESSAGE_BATCH_SIZE,
    start = '0-0'
} = {}) {
    if (typeof redisClient.xautoclaim !== 'function') {
        return { nextStart: '0-0', messages: [] };
    }

    const response = await redisClient.xautoclaim(
        streamKey,
        group,
        consumer,
        minIdleMs,
        start,
        'COUNT',
        count
    );

    if (!Array.isArray(response) || response.length < 2) {
        return { nextStart: '0-0', messages: [] };
    }

    return {
        nextStart: response[0] || '0-0',
        messages: normalizeStreamMessages(Array.isArray(response[1]) ? response[1] : [])
    };
}

async function readNewMessages({
    redisClient = redis,
    streamKey = STREAM_KEY,
    group = GROUP,
    consumer = CONSUMER,
    blockMs = BLOCK_TIMEOUT_MS,
    count = MESSAGE_BATCH_SIZE
} = {}) {
    const response = await redisClient.xreadgroup(
        'GROUP',
        group,
        consumer,
        'BLOCK',
        blockMs,
        'COUNT',
        count,
        'STREAMS',
        streamKey,
        '>'
    );

    if (!response) {
        return [];
    }

    return response.flatMap(([, messages]) => normalizeStreamMessages(messages));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updatePendingGaugeOnce({
    redisClient = redis,
    gauge = workerPendingGauge,
    streamKey = STREAM_KEY,
    group = GROUP
} = {}) {
    if (!gauge || typeof gauge.set !== 'function' || typeof redisClient.xpending !== 'function') {
        return 0;
    }

    const summary = await redisClient.xpending(streamKey, group);
    const pendingCount = extractPendingCount(summary);
    gauge.set(pendingCount);
    return pendingCount;
}

async function loop(options = {}) {
    const logger = options.logger || console;
    let claimStart = '0-0';

    /* eslint-disable no-constant-condition */
    while (true) {
        try {
            const claimResult = await claimStaleMessages({
                ...options,
                start: claimStart
            });
            claimStart = claimResult.nextStart || '0-0';

            if (claimResult.messages.length > 0) {
                await processStreamMessages(claimResult.messages, options);
                continue;
            }

            if (claimStart !== '0-0') {
                continue;
            }

            const messages = await readNewMessages(options);
            if (!messages.length) {
                continue;
            }

            await processStreamMessages(messages, options);
        } catch (err) {
            logError(logger, '[realtime-worker] loop error', err);
            await sleep(options.retryDelayMs || LOOP_RETRY_DELAY_MS);
        }
    }
    /* eslint-enable no-constant-condition */
}

async function startBackgroundServices(options = {}) {
    const mongooseLib = options.mongooseLib || mongoose;
    const logger = options.logger || console;
    const env = normalizeWorkerEnv(options.env || process.env);
    const runtimeConfig = options.runtimeConfig || validateRuntimeConfig(env);
    const automationConfig = runtimeConfig.automation || {};
    const automationStarted = hasEnabledAutomation(automationConfig);
    const realtimeStarted = options.realtimeEnabled === undefined
        ? isRealtimeConfigured(env)
        : Boolean(options.realtimeEnabled);
    const streamKey = options.streamKey || STREAM_KEY;
    const group = options.group || GROUP;
    const consumer = options.consumer || CONSUMER;
    const metricIntervalMs = options.metricIntervalMs || METRICS_INTERVAL_MS;
    const mongoUri = options.mongoUri || runtimeConfig.dbURI || env.MONGODB_URI || 'mongodb://127.0.0.1:27017/note-app';
    const redisClient = options.redisClient || redis;
    const startAutomationFn = options.startAutomationFn || startAutomation;

    if (!automationStarted && !realtimeStarted) {
        logInfo(logger, '[background-worker] no automation or realtime services enabled');
        return {
            started: false,
            automationStarted: false,
            realtimeStarted: false,
            stop: async () => {}
        };
    }

    await mongooseLib.connect(mongoUri, options.mongooseConnectOptions || {});
    logInfo(logger, '[background-worker] connected to mongo');

    let automationController = null;
    if (automationStarted) {
        automationController = startAutomationFn(automationConfig, { unrefTimers: false });
        logInfo(logger, '[background-worker] scheduled automation started');
    }

    let interval = null;
    if (realtimeStarted) {
        await createConsumerGroup({ redisClient, streamKey, group, logger });
        interval = setInterval(async () => {
            try {
                await updatePendingGaugeOnce({
                    redisClient,
                    gauge: options.gauge || workerPendingGauge,
                    streamKey,
                    group
                });
            } catch (_e) {
                // ignore
            }
        }, metricIntervalMs);
        interval.unref?.();
    } else {
        logInfo(logger, '[realtime-worker] realtime loop disabled; Redis is unavailable or ENABLE_REALTIME is not set to 1');
    }

    return {
        started: true,
        automationStarted,
        realtimeStarted,
        redisClient,
        streamKey,
        group,
        consumer,
        stop: async () => {
            if (interval) {
                clearInterval(interval);
            }
            if (automationController && typeof automationController.stop === 'function') {
                automationController.stop();
            }
            if (options.disconnectMongoOnStop !== false && typeof mongooseLib.disconnect === 'function') {
                await mongooseLib.disconnect();
            }
        }
    };
}

async function start(options = {}) {
    const logger = options.logger || console;

    try {
        const workerState = await startBackgroundServices(options);
        if (!workerState.started || !workerState.realtimeStarted) {
            return workerState;
        }

        logInfo(logger, '[realtime-worker] starting main loop');
        return loop({
            ...options,
            redisClient: workerState.redisClient,
            streamKey: workerState.streamKey,
            group: workerState.group,
            consumer: workerState.consumer
        });
    } catch (error) {
        logError(logger, '[background-worker] startup failed', error);
        process.exit(1);
        return null;
    }
}

if (require.main === module) {
    start();
}

module.exports = {
    STREAM_KEY,
    DEAD_LETTER_STREAM_KEY,
    GROUP,
    CONSUMER,
    parseStreamFields,
    extractPendingCount,
    createConsumerGroup,
    handleMessage,
    hasEnabledAutomation,
    isRealtimeConfigured,
    claimStaleMessages,
    readNewMessages,
    startBackgroundServices,
    updatePendingGaugeOnce,
    start
};
