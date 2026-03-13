const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const { buildScanAlertCorrelations } = require('../utils/correlationAnalysis');
const { analyzeLogText, MAX_LOG_TEXT_LENGTH } = require('../utils/logAnalysis');
const { handleApiError } = require('../utils/errorHandler');
const { buildPersistedCorrelationDemo, buildSampleCorrelationInputs } = require('../utils/sampleCorrelationData');
const { persistAutomatedAlerts, persistAutomatedScan } = require('../services/automationService');

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
