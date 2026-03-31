const mongoose = require('mongoose');

const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const { buildScanAlertCorrelations } = require('../utils/correlationAnalysis');
const { buildPersistedCorrelationDemo, buildSampleCorrelationInputs } = require('../utils/sampleCorrelationData');
const { VALID_FEEDBACK_LABELS, enrichAlertForTriage, enrichAlertsForTriage } = require('../utils/alertTriage');
const { persistAutomatedAlerts, persistAutomatedScan } = require('./automationService');
const { persistLogAnalysis } = require('./securityIngestService');

const ALERT_LIST_SELECT = 'type severity summary details detectedAt feedback mlScore mlLabel mlReasons mlFeatures scoreSource response';
const SCAN_LIST_SELECT = 'target tool findings summary importedAt';
const ALERT_SORT_RECENT = { detectedAt: -1, createdAt: -1 };
const ALERT_SORT_ML_SCORE = { mlScore: -1, detectedAt: -1, createdAt: -1 };

function parseLimit(value, fallback = 20, max = 100) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(parsed, max);
}

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function normalizeAlertSort(value) {
    return String(value || '').trim().toLowerCase() === 'ml_score'
        ? 'ml_score'
        : 'recent';
}

async function resolveLeanResult(queryOrValue) {
    if (queryOrValue && typeof queryOrValue.lean === 'function') {
        return queryOrValue.lean();
    }

    return queryOrValue;
}

async function analyzeLogsForUser({ userId, logText }) {
    return persistLogAnalysis({
        userId,
        source: 'manual-log-input',
        logText
    });
}

async function listAlertsForUser({ userId, limit, sort }) {
    const [alerts, totalCount] = await Promise.all([
        SecurityAlert.find({ user: userId })
            .select(ALERT_LIST_SELECT)
            .sort(sort === 'ml_score' ? ALERT_SORT_ML_SCORE : ALERT_SORT_RECENT)
            .lean()
            .limit(limit),
        SecurityAlert.countDocuments({ user: userId })
    ]);

    const enrichedAlerts = enrichAlertsForTriage(alerts);
    if (sort === 'ml_score') {
        enrichedAlerts.sort((left, right) => {
            const scoreDelta = Number(right.mlScore || 0) - Number(left.mlScore || 0);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }

            return new Date(right.detectedAt || 0).getTime() - new Date(left.detectedAt || 0).getTime();
        });
    }

    return {
        count: enrichedAlerts.length,
        totalCount,
        sort,
        data: enrichedAlerts
    };
}

async function updateAlertFeedbackForUser({ userId, alertId, feedbackLabel }) {
    if (!isValidObjectId(alertId)) {
        return {
            ok: false,
            status: 400,
            message: 'Invalid alert ID format',
            errors: ['The provided alert ID is not valid']
        };
    }

    if (!VALID_FEEDBACK_LABELS.includes(feedbackLabel)) {
        return {
            ok: false,
            status: 400,
            message: 'Validation failed',
            errors: [`feedbackLabel must be one of: ${VALID_FEEDBACK_LABELS.join(', ')}`]
        };
    }

    const existingAlert = await resolveLeanResult(SecurityAlert.findOne({ _id: alertId, user: userId }));
    if (!existingAlert) {
        return {
            ok: false,
            status: 404,
            message: 'Alert not found or access denied',
            errors: ['The alert does not exist or you do not have permission to update it']
        };
    }

    const triagedAlert = enrichAlertForTriage({
        ...existingAlert,
        feedback: {
            label: feedbackLabel,
            updatedAt: new Date()
        }
    });

    const updateQuery = SecurityAlert.findOneAndUpdate(
        { _id: alertId, user: userId },
        {
            feedback: triagedAlert.feedback,
            mlScore: triagedAlert.mlScore,
            mlLabel: triagedAlert.mlLabel,
            mlReasons: triagedAlert.mlReasons,
            mlFeatures: triagedAlert.mlFeatures,
            scoreSource: triagedAlert.scoreSource
        },
        {
            new: true,
            runValidators: true
        }
    );
    if (updateQuery && typeof updateQuery.select === 'function') {
        updateQuery.select(ALERT_LIST_SELECT);
    }

    const savedAlert = await resolveLeanResult(updateQuery);

    return {
        ok: true,
        message: 'Alert feedback updated',
        data: enrichAlertForTriage(savedAlert)
    };
}

async function listCorrelationsForUser({ userId, limit }) {
    const [alerts, scans] = await Promise.all([
        SecurityAlert.find({ user: userId })
            .select(ALERT_LIST_SELECT)
            .sort({ detectedAt: -1, createdAt: -1 })
            .lean()
            .limit(50),
        ScanResult.find({ user: userId })
            .select(SCAN_LIST_SELECT)
            .sort({ importedAt: -1, createdAt: -1 })
            .lean()
            .limit(50)
    ]);

    const correlationPayload = buildScanAlertCorrelations(scans, alerts, limit);

    return {
        count: correlationPayload.correlations.length,
        totalCount: correlationPayload.totalCount,
        data: correlationPayload.correlations,
        overview: correlationPayload.overview
    };
}

async function createSampleCorrelationsForUser({ userId }) {
    const sampleInput = buildPersistedCorrelationDemo();
    const alertSource = 'correlation-demo';
    const scanSource = 'correlation-demo';

    const [savedScans, savedAlerts] = await Promise.all([
        ScanResult.insertMany(sampleInput.scans.map((scan) => ({
            ...scan,
            user: userId,
            source: scanSource
        }))),
        SecurityAlert.insertMany(enrichAlertsForTriage(sampleInput.alerts.map((alert) => ({
            ...alert,
            user: userId,
            source: alertSource
        }))))
    ]);

    const [alerts, scans] = await Promise.all([
        SecurityAlert.find({ user: userId })
            .select(ALERT_LIST_SELECT)
            .sort({ detectedAt: -1, createdAt: -1 })
            .lean()
            .limit(50),
        ScanResult.find({ user: userId })
            .select(SCAN_LIST_SELECT)
            .sort({ importedAt: -1, createdAt: -1 })
            .lean()
            .limit(50)
    ]);

    const correlationPayload = buildScanAlertCorrelations(scans, alerts, 20);

    return {
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
    };
}

async function injectAutomationSampleForUser({ userId, runtimeAutomation }) {
    const sampleInput = buildSampleCorrelationInputs();
    const automation = runtimeAutomation || {};
    const alertSource = automation.logBatch && automation.logBatch.source
        ? automation.logBatch.source
        : 'server-log-batch';
    const scanSource = automation.scanBatch && automation.scanBatch.source
        ? automation.scanBatch.source
        : 'scheduled-scan-import';

    const [alertResult, scanResult] = await Promise.all([
        persistAutomatedAlerts({
            userId,
            source: alertSource,
            dedupeWindowMs: 0,
            respondToIncidents: false
        }, sampleInput.sampleLogText),
        persistAutomatedScan({
            userId,
            source: scanSource,
            dedupeWindowMs: 0
        }, sampleInput.sampleScanText)
    ]);

    return {
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
    };
}

module.exports = {
    analyzeLogsForUser,
    createSampleCorrelationsForUser,
    injectAutomationSampleForUser,
    listAlertsForUser,
    listCorrelationsForUser,
    normalizeAlertSort,
    parseLimit,
    updateAlertFeedbackForUser
};
