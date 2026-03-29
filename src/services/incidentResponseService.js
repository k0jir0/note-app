const SecurityAlert = require('../models/SecurityAlert');
const blockingService = require('./blockingService');
const notificationService = require('./notificationService');
const { runTelemetryAwareBulkWrite } = require('../utils/databaseTelemetry');
const { encryptSecurityAlertBulkWriteOperations } = require('../utils/sensitiveModelEncryption');

const POLICY_VERSION = 'ml-autonomous-v1';
const DEFAULT_ALLOWED_SOURCES = ['server-log-batch', 'intrusion-runner', 'realtime-ingest'];
const RESPONSE_LEVELS = ['none', 'notify', 'block'];
const ACTION_STATUSES = ['planned', 'sent', 'skipped', 'failed'];

function parseBooleanFlag(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return fallback;
}

function parseThreshold(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, Math.min(1, parsed));
}

function parseAllowedSources(value, fallback = DEFAULT_ALLOWED_SOURCES) {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback.slice();
    }

    const parsed = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    return parsed.length > 0 ? parsed : fallback.slice();
}

function getIncidentResponseConfig(env = process.env) {
    return {
        enabled: parseBooleanFlag(env.AUTONOMOUS_RESPONSE_ENABLED, true),
        allowedSources: parseAllowedSources(env.AUTONOMOUS_RESPONSE_ALLOWED_SOURCES),
        notifyThreshold: parseThreshold(env.AUTONOMOUS_NOTIFY_SCORE_THRESHOLD, 0.72),
        blockThreshold: parseThreshold(env.AUTONOMOUS_BLOCK_SCORE_THRESHOLD, 0.9),
        requireTrainedModelForBlock: parseBooleanFlag(env.AUTONOMOUS_REQUIRE_TRAINED_MODEL_FOR_BLOCK, true),
        notifyOnImportantFeedback: parseBooleanFlag(env.AUTONOMOUS_NOTIFY_ON_IMPORTANT_FEEDBACK, true),
        policyVersion: POLICY_VERSION
    };
}

function normalizeAlert(alert = {}) {
    return typeof alert.toObject === 'function' ? alert.toObject() : { ...alert };
}

function normalizeAlertId(alert = {}) {
    if (alert._id !== undefined && alert._id !== null) {
        return String(alert._id);
    }

    if (alert.id !== undefined && alert.id !== null) {
        return String(alert.id);
    }

    return '';
}

function hasTrainedScore(alert = {}) {
    return String(alert.scoreSource || '').includes('trained-logistic-regression');
}

function deriveResponseTarget(alert = {}) {
    const details = alert.details && typeof alert.details === 'object'
        ? alert.details
        : {};

    return details.ip || details.src || details.target || '';
}

function createActionRecord({
    type,
    status,
    provider,
    detail,
    target,
    recordedAt
}) {
    const safeStatus = ACTION_STATUSES.includes(status) ? status : 'planned';

    return {
        type,
        status: safeStatus,
        provider: provider || '',
        detail: detail || '',
        target: target || '',
        recordedAt
    };
}

function buildBaseResponse({
    config,
    score,
    trainedScoreUsed,
    target,
    level,
    reason,
    evaluatedAt
}) {
    return {
        policyVersion: config.policyVersion,
        level: RESPONSE_LEVELS.includes(level) ? level : 'none',
        reason,
        scoreAtDecision: Number.isFinite(score) ? Number(score.toFixed(3)) : null,
        trainedScoreUsed: Boolean(trainedScoreUsed),
        target: target || '',
        evaluatedAt,
        actions: []
    };
}

function buildIncidentResponseDecision(alert = {}, options = {}) {
    const config = options.config || getIncidentResponseConfig(options.env);
    const evaluatedAt = options.now || new Date();
    const source = String(alert.source || '');
    const feedbackLabel = String(alert.feedback && alert.feedback.label ? alert.feedback.label : 'unreviewed');
    const score = Number(alert.mlScore);
    const safeScore = Number.isFinite(score) ? score : 0;
    const trainedScoreUsed = hasTrainedScore(alert);
    const target = deriveResponseTarget(alert);

    if (!config.enabled) {
        return buildBaseResponse({
            config,
            score: safeScore,
            trainedScoreUsed,
            target,
            level: 'none',
            reason: 'Autonomous response is disabled by configuration.',
            evaluatedAt
        });
    }

    if (!config.allowedSources.includes(source)) {
        return buildBaseResponse({
            config,
            score: safeScore,
            trainedScoreUsed,
            target,
            level: 'none',
            reason: `Source "${source || 'unknown'}" is not eligible for autonomous response.`,
            evaluatedAt
        });
    }

    if (feedbackLabel === 'false_positive' || feedbackLabel === 'resolved') {
        return buildBaseResponse({
            config,
            score: safeScore,
            trainedScoreUsed,
            target,
            level: 'none',
            reason: `Analyst feedback "${feedbackLabel}" suppresses autonomous response.`,
            evaluatedAt
        });
    }

    const response = buildBaseResponse({
        config,
        score: safeScore,
        trainedScoreUsed,
        target,
        level: 'none',
        reason: 'Alert did not cross the autonomous response thresholds.',
        evaluatedAt
    });

    const notifyEligible = safeScore >= config.notifyThreshold
        || (config.notifyOnImportantFeedback && feedbackLabel === 'important');
    const blockEligible = Boolean(target)
        && String(alert.severity || 'low') === 'high'
        && safeScore >= config.blockThreshold
        && (!config.requireTrainedModelForBlock || trainedScoreUsed);

    if (blockEligible) {
        response.level = 'block';
        response.reason = `ML score ${safeScore.toFixed(2)} crossed the autonomous block threshold for a high-severity alert.`;
        response.actions.push(
            createActionRecord({
                type: 'notify',
                status: 'planned',
                provider: 'summary-notifier',
                detail: 'Notification will be attempted before or alongside the block action.',
                target,
                recordedAt: evaluatedAt
            }),
            createActionRecord({
                type: 'block',
                status: 'planned',
                provider: 'block-webhook',
                detail: `Target ${target} is eligible for an automated block attempt.`,
                target,
                recordedAt: evaluatedAt
            })
        );
        return response;
    }

    if (notifyEligible) {
        response.level = 'notify';
        response.reason = feedbackLabel === 'important'
            ? 'Analyst feedback marked this alert as important, so the notifier threshold was bypassed.'
            : `ML score ${safeScore.toFixed(2)} crossed the autonomous notify threshold.`;
        response.actions.push(createActionRecord({
            type: 'notify',
            status: 'planned',
            provider: 'summary-notifier',
            detail: 'Notification will be attempted for this alert.',
            target,
            recordedAt: evaluatedAt
        }));
    }

    return response;
}

function summarizeNotificationOutcome(result = {}) {
    const slack = result.slack || {};
    const email = result.email || {};
    const sent = Boolean(slack.ok || email.ok);
    const failed = Boolean(slack.error || email.error);
    const skipped = Boolean(slack.skipped && email.skipped);

    if (sent) {
        return {
            status: 'sent',
            detail: 'At least one notification channel accepted the alert summary.'
        };
    }

    if (failed) {
        const detail = [slack.error, email.error].filter(Boolean).join(' | ') || 'Notification delivery failed.';
        return {
            status: 'failed',
            detail
        };
    }

    if (skipped) {
        return {
            status: 'skipped',
            detail: 'Notification channels are not configured.'
        };
    }

    return {
        status: 'skipped',
        detail: 'Notification attempt produced no actionable result.'
    };
}

function summarizeBlockOutcome(resultEntry) {
    const result = resultEntry && resultEntry.result ? resultEntry.result : {};

    if (result.ok) {
        return {
            status: 'sent',
            detail: `Block webhook accepted the target ${resultEntry.target || ''}.`.trim()
        };
    }

    if (result.error) {
        return {
            status: 'failed',
            detail: String(result.error)
        };
    }

    if (result.skipped) {
        return {
            status: 'skipped',
            detail: result.reason || 'Block webhook is not configured or no target was available.'
        };
    }

    return {
        status: 'failed',
        detail: 'Block attempt did not complete successfully.'
    };
}

async function persistResponses(alerts = [], options = {}) {
    const SecurityAlertModel = options.SecurityAlertModel || SecurityAlert;
    if (typeof SecurityAlertModel.bulkWrite !== 'function') {
        return 0;
    }

    const operations = alerts
        .filter((alert) => alert && alert.response && normalizeAlertId(alert))
        .map((alert) => ({
            updateOne: {
                filter: { _id: alert._id || alert.id },
                update: {
                    $set: {
                        response: alert.response
                    }
                }
            }
        }));

    if (operations.length === 0) {
        return 0;
    }

    encryptSecurityAlertBulkWriteOperations(operations);
    await runTelemetryAwareBulkWrite({
        model: SecurityAlertModel,
        modelName: 'SecurityAlert',
        operations,
        bulkWriteOptions: { ordered: false }
    });
    return operations.length;
}

async function executeIncidentResponses(alerts = [], options = {}) {
    if (!Array.isArray(alerts) || alerts.length === 0) {
        return {
            alerts: [],
            notificationOutcome: { skipped: true },
            blockResults: [],
            persistedCount: 0
        };
    }

    const config = options.config || getIncidentResponseConfig(options.env);
    const notifyAlertsSummaryFn = options.notifyAlertsSummaryFn || notificationService.notifyAlertsSummary;
    const sendBlockRequestsForAlertsFn = options.sendBlockRequestsForAlertsFn || blockingService.sendBlockRequestsForAlerts;
    const evaluatedAt = options.now || new Date();
    const normalizedAlerts = alerts.map((alert) => normalizeAlert(alert));
    const responseById = new Map();

    normalizedAlerts.forEach((alert) => {
        const response = buildIncidentResponseDecision(alert, {
            config,
            now: evaluatedAt
        });
        responseById.set(normalizeAlertId(alert), response);
    });

    const notifyEligibleAlerts = normalizedAlerts.filter((alert) => {
        const response = responseById.get(normalizeAlertId(alert));
        return response && ['notify', 'block'].includes(response.level);
    });

    let notificationOutcome = { skipped: true };
    if (notifyEligibleAlerts.length > 0) {
        try {
            notificationOutcome = await notifyAlertsSummaryFn(notifyEligibleAlerts);
        } catch (error) {
            notificationOutcome = { error: String(error) };
        }
    }

    const blockEligibleAlerts = normalizedAlerts.filter((alert) => {
        const response = responseById.get(normalizeAlertId(alert));
        return response && response.level === 'block';
    });

    let blockResults = [];
    if (blockEligibleAlerts.length > 0) {
        try {
            blockResults = await sendBlockRequestsForAlertsFn(blockEligibleAlerts);
        } catch (error) {
            blockResults = blockEligibleAlerts.map((alert) => ({
                alertId: normalizeAlertId(alert),
                target: deriveResponseTarget(alert),
                result: { error: String(error) }
            }));
        }
    }

    const blockByAlertId = new Map(
        blockResults.map((entry) => [String(entry.alertId || ''), entry])
    );
    const notificationSummary = summarizeNotificationOutcome(notificationOutcome);

    const updatedAlerts = normalizedAlerts.map((alert) => {
        const alertId = normalizeAlertId(alert);
        const response = responseById.get(alertId) || buildIncidentResponseDecision(alert, {
            config,
            now: evaluatedAt
        });

        const finalizedActions = response.actions.map((action) => {
            if (action.type === 'notify') {
                return createActionRecord({
                    ...action,
                    status: notificationSummary.status,
                    detail: notificationSummary.detail,
                    recordedAt: evaluatedAt
                });
            }

            const blockEntry = blockByAlertId.get(alertId);
            const blockSummary = summarizeBlockOutcome(blockEntry);
            return createActionRecord({
                ...action,
                status: blockSummary.status,
                detail: blockSummary.detail,
                recordedAt: evaluatedAt
            });
        });

        return {
            ...alert,
            response: {
                ...response,
                actions: finalizedActions
            }
        };
    });

    let persistedCount = 0;
    try {
        persistedCount = await persistResponses(updatedAlerts, options);
    } catch (error) {
        console.warn('[incident-response] failed to persist response metadata', error && error.message ? error.message : error);
    }

    return {
        alerts: updatedAlerts,
        notificationOutcome,
        blockResults,
        persistedCount
    };
}

module.exports = {
    ACTION_STATUSES,
    DEFAULT_ALLOWED_SOURCES,
    POLICY_VERSION,
    buildIncidentResponseDecision,
    executeIncidentResponses,
    getIncidentResponseConfig
};
