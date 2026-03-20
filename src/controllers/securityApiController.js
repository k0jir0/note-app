const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const { buildScanAlertCorrelations } = require('../utils/correlationAnalysis');
const { analyzeLogText, MAX_LOG_TEXT_LENGTH } = require('../utils/logAnalysis');
const { handleApiError } = require('../utils/errorHandler');
const { buildPersistedCorrelationDemo, buildSampleCorrelationInputs } = require('../utils/sampleCorrelationData');
const { persistAutomatedAlerts, persistAutomatedScan } = require('../services/automationService');
const { redis, subscriber } = require('../lib/redisClient');
const { ingestCounter } = require('../routes/metrics');

const parseLimit = (value, fallback = 20, max = 100) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(parsed, max);
};

exports.analyzeLogs = async (req, res) => {
    try {
        const logText = typeof req.body.logText === 'string' ? req.body.logText : '';

        if (!logText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['logText is required']
            });
        }

        const analysis = analyzeLogText(logText);

        const alertsToCreate = analysis.alerts.map((alert) => ({
            ...alert,
            user: req.user._id,
            source: 'manual-log-input',
            detectedAt: new Date()
        }));

        let savedAlerts = [];
        if (alertsToCreate.length > 0) {
            savedAlerts = await SecurityAlert.insertMany(alertsToCreate);
        }

        return res.status(200).json({
            success: true,
            message: 'Log analysis completed',
            data: {
                linesAnalyzed: analysis.linesAnalyzed,
                truncated: analysis.truncated,
                inputLimit: MAX_LOG_TEXT_LENGTH,
                createdAlerts: savedAlerts.length,
                alerts: savedAlerts
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Analyze logs');
    }
};

exports.getAlerts = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 100);

        const [alerts, totalCount] = await Promise.all([
            SecurityAlert.find({ user: req.user._id })
                .sort({ detectedAt: -1, createdAt: -1 })
                .limit(limit),
            SecurityAlert.countDocuments({ user: req.user._id })
        ]);

        return res.status(200).json({
            success: true,
            count: alerts.length,
            totalCount,
            data: alerts
        });
    } catch (error) {
        return handleApiError(res, error, 'Get security alerts');
    }
};

exports.getCorrelations = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);

        const [alerts, scans] = await Promise.all([
            SecurityAlert.find({ user: req.user._id })
                .sort({ detectedAt: -1, createdAt: -1 })
                .limit(50),
            ScanResult.find({ user: req.user._id })
                .sort({ importedAt: -1, createdAt: -1 })
                .limit(50)
        ]);

        const correlationPayload = buildScanAlertCorrelations(scans, alerts, limit);

        return res.status(200).json({
            success: true,
            count: correlationPayload.correlations.length,
            totalCount: correlationPayload.totalCount,
            data: correlationPayload.correlations,
            overview: correlationPayload.overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get correlations');
    }
};

exports.getSampleCorrelations = async (req, res) => {
    try {
        const sampleInput = buildPersistedCorrelationDemo();
        const alertSource = 'correlation-demo';
        const scanSource = 'correlation-demo';

        // Append demo records instead of removing existing ones
        const savedScans = await ScanResult.insertMany(sampleInput.scans.map((scan) => ({
            ...scan,
            user: req.user._id,
            source: scanSource
        })));

        const savedAlerts = await SecurityAlert.insertMany(sampleInput.alerts.map((alert) => ({
            ...alert,
            user: req.user._id,
            source: alertSource
        })));

        // After inserting, include existing user alerts/scans when building correlations
        const [alerts, scans] = await Promise.all([
            SecurityAlert.find({ user: req.user._id })
                .sort({ detectedAt: -1, createdAt: -1 })
                .limit(50),
            ScanResult.find({ user: req.user._id })
                .sort({ importedAt: -1, createdAt: -1 })
                .limit(50)
        ]);

        const correlationPayload = buildScanAlertCorrelations(scans, alerts, 20);

        return res.status(200).json({
            success: true,
            message: 'Correlation demo injected',
            count: correlationPayload.correlations.length,
            totalCount: correlationPayload.totalCount,
            data: correlationPayload.correlations,
            overview: correlationPayload.overview,
            meta: {
                sample: true,
                persisted: true,
                createdScans: savedScans.length,
                createdAlerts: savedAlerts.length,
                targets: sampleInput.targets,
                logSummaries: sampleInput.logSummaries
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Get sample correlations');
    }
};

exports.injectAutomationSample = async (req, res) => {
    try {
        const sampleInput = buildSampleCorrelationInputs();
        const runtimeAutomation = (req.app && req.app.locals && req.app.locals.runtimeConfig && req.app.locals.runtimeConfig.automation)
            ? req.app.locals.runtimeConfig.automation
            : {};
        const alertSource = runtimeAutomation.logBatch && runtimeAutomation.logBatch.source
            ? runtimeAutomation.logBatch.source
            : 'server-log-batch';
        const scanSource = runtimeAutomation.scanBatch && runtimeAutomation.scanBatch.source
            ? runtimeAutomation.scanBatch.source
            : 'scheduled-scan-import';

        const [alertResult, scanResult] = await Promise.all([
            persistAutomatedAlerts({
                userId: req.user._id,
                source: alertSource,
                dedupeWindowMs: 0
            }, sampleInput.sampleLogText),
            persistAutomatedScan({
                userId: req.user._id,
                source: scanSource,
                dedupeWindowMs: 0
            }, sampleInput.sampleScanText)
        ]);

        console.log(`[automation] sample injection created ${alertResult.createdAlerts} alert(s) and ${scanResult.findingsCount || 0} finding(s) for user ${req.user._id}`);

        return res.status(200).json({
            success: true,
            message: 'Automation sample injected',
            data: {
                createdAlerts: alertResult.createdAlerts,
                skippedAlerts: alertResult.skippedAlerts,
                scanCreated: Boolean(scanResult.created),
                scanSkippedReason: scanResult.reason || null,
                findingsCount: scanResult.findingsCount || 0,
                alertSource,
                scanSource
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Inject automation sample');
    }
};

// Enqueue inbound log text (real-time ingestion)
exports.realtimeIngest = async (req, res) => {
    try {
        if (!req.app || !req.app.locals || !req.app.locals.realtimeEnabled) {
            return res.status(404).json({ success: false, message: 'Realtime ingestion is disabled' });
        }
        const payload = req.body || {};
        const { type = 'log', logText = '', raw = '' } = payload;

        if (type === 'log' && typeof logText !== 'string') {
            return res.status(400).json({ success: false, errors: ['logText must be a string'] });
        }

        // Create a message for Redis Stream
        const message = {
            type,
            user: String(req.user._id),
            logText: type === 'log' ? logText : '',
            raw: raw || ''
        };

        // XADD to stream (auto id)
        await redis.xadd('security:ingest', '*', 'payload', JSON.stringify(message));

        // increment Prometheus counter
        try { ingestCounter.inc({ type }); } catch (e) { void e; }

        return res.status(202).json({ success: true, message: 'Enqueued for real-time processing' });
    } catch (error) {
        return handleApiError(res, error, 'Realtime ingest');
    }
};

// Server-Sent Events endpoint for live alerts
exports.streamEvents = async (req, res) => {
    try {
        if (!req.app || !req.app.locals || !req.app.locals.realtimeEnabled) {
            return res.status(404).json({ success: false, message: 'Realtime endpoint disabled' });
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const send = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send a simple keep-alive every 25s
        const keepAlive = setInterval(() => {
            res.write(': keep-alive\n\n');
        }, 25000);

        // Subscribe to a per-user Redis pubsub channel for immediate events
        const userId = String(req.user && req.user._id ? req.user._id : 'global');
        const channel = `security:events:${userId}`;
        const localSubscriber = typeof subscriber.duplicate === 'function'
            ? subscriber.duplicate()
            : subscriber;

        const onMessage = (chan, message) => {
            if (chan === channel) {
                try {
                    const payload = JSON.parse(message);
                    send(payload);
                } catch (_e) {
                    send({ error: 'malformed event' });
                }
            }
        };

        localSubscriber.subscribe(channel).then(() => {
            localSubscriber.on('message', onMessage);
        }).catch((e) => { void e; });

        // Cleanup when client disconnects
        req.on('close', () => {
            clearInterval(keepAlive);
            try { localSubscriber.removeListener('message', onMessage); } catch (e) { void e; }
            try { localSubscriber.unsubscribe(channel); } catch (e) { void e; }
            if (localSubscriber !== subscriber) {
                try { localSubscriber.quit(); } catch (e) { void e; }
                try { localSubscriber.disconnect(); } catch (e) { void e; }
            }
            res.end();
        });
    } catch (error) {
        return handleApiError(res, error, 'Stream events');
    }
};
