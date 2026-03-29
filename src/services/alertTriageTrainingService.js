const SecurityAlert = require('../models/SecurityAlert');
const { getIncidentResponseConfig } = require('./incidentResponseService');
const { enrichAlertsForTriage } = require('../utils/alertTriage');
const {
    TRAINABLE_FEEDBACK_CONFIG,
    buildTrainingExampleFromAlert,
    generateSyntheticTrainingExamples
} = require('../utils/alertTriageTrainingData');
const {
    loadAlertTriageModel,
    resolveAlertTriageModelPath,
    saveAlertTriageModel,
    trainAlertTriageModel
} = require('../utils/alertTriageModel');
const { encryptSecurityAlertBulkWriteOperations } = require('../utils/sensitiveModelEncryption');

const TRAINABLE_FEEDBACK_LABELS = Object.keys(TRAINABLE_FEEDBACK_CONFIG);
const RECENT_ALERT_LIMIT = 8;
const MODEL_SUMMARY_FIELDS = [
    'version',
    'modelType',
    'scoreSource',
    'trainedAt',
    'trainingSamples',
    'positiveSamples',
    'negativeSamples',
    'metrics',
    'sources'
];
const SCORE_BUCKETS = [
    { label: '0.00-0.24', min: 0, max: 0.249999 },
    { label: '0.25-0.49', min: 0.25, max: 0.499999 },
    { label: '0.50-0.74', min: 0.5, max: 0.749999 },
    { label: '0.75-1.00', min: 0.75, max: 1 }
];
const FEATURE_LABELS = {
    count_norm: 'Activity Volume',
    threshold_norm: 'Threshold Distance',
    ratio_norm: 'Failure / Enumeration Ratio',
    sample_size_norm: 'Repeated Evidence',
    tool_count_norm: 'Scanner Tool Count',
    source_ip_count_norm: 'Source IP Spread',
    summary_length_norm: 'Alert Context Size',
    has_ip_indicator: 'Concrete IP Indicator',
    has_fingerprint: 'Stable Fingerprint',
    severity_low: 'Severity: Low',
    severity_medium: 'Severity: Medium',
    severity_high: 'Severity: High',
    type_failed_login_burst: 'Type: Failed Login Burst',
    type_suspicious_path_probe: 'Type: Suspicious Path Probe',
    type_high_error_rate: 'Type: High Error Rate',
    type_scanner_tool_detected: 'Type: Scanner Tool Detected',
    type_injection_attempt: 'Type: Injection Attempt',
    type_directory_enumeration: 'Type: Directory Enumeration',
    type_unknown: 'Type: Unknown'
};

function hasConfiguredValue(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function getRuntimeModel(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'model')) {
        return options.model;
    }

    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_ALERT_TRIAGE_MODEL === '1') {
        return null;
    }

    return loadAlertTriageModel();
}

function summarizeCounts(items = [], getKey, preferredOrder = []) {
    const counts = items.reduce((summary, item) => {
        const key = getKey(item);
        summary[key] = (summary[key] || 0) + 1;
        return summary;
    }, {});

    const used = new Set();
    const orderedEntries = preferredOrder
        .filter((key) => counts[key])
        .map((key) => {
            used.add(key);
            return [key, counts[key]];
        });
    const extraEntries = Object.entries(counts)
        .filter(([key]) => !used.has(key))
        .sort(([left], [right]) => left.localeCompare(right));

    return [...orderedEntries, ...extraEntries].map(([label, count]) => ({
        label,
        count
    }));
}

function formatFeatureLabel(featureName) {
    return FEATURE_LABELS[featureName] || String(featureName || 'unknown')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildFeatureHighlights(model, direction, limit = 6) {
    if (!model || !Array.isArray(model.featureNames) || !Array.isArray(model.weights)) {
        return [];
    }

    const multiplier = direction === 'negative' ? -1 : 1;
    return model.featureNames
        .map((name, index) => ({
            key: name,
            label: formatFeatureLabel(name),
            weight: Number(model.weights[index] || 0)
        }))
        .filter((feature) => Number.isFinite(feature.weight))
        .filter((feature) => (direction === 'negative' ? feature.weight < 0 : feature.weight > 0))
        .sort((left, right) => (right.weight * multiplier) - (left.weight * multiplier))
        .slice(0, limit)
        .map((feature) => ({
            key: feature.key,
            label: feature.label,
            weight: Number(feature.weight.toFixed(3)),
            strength: Number(Math.abs(feature.weight).toFixed(3))
        }));
}

function buildScoreBuckets(alerts = []) {
    const total = alerts.length || 1;
    return SCORE_BUCKETS.map((bucket) => {
        const count = alerts.filter((alert) => {
            const score = Number(alert.mlScore);
            return Number.isFinite(score) && score >= bucket.min && score <= bucket.max;
        }).length;

        return {
            label: bucket.label,
            count,
            proportion: Number((count / total).toFixed(3))
        };
    });
}

function buildAlertTypePriorityBreakdown(alerts = []) {
    const summary = alerts.reduce((result, alert) => {
        const key = String(alert.type || 'unknown');
        if (!result[key]) {
            result[key] = {
                label: formatFeatureLabel(`type_${key}`),
                high: 0,
                medium: 0,
                low: 0,
                total: 0
            };
        }

        const label = ['high', 'medium', 'low'].includes(alert.mlLabel)
            ? alert.mlLabel
            : 'low';
        result[key][label] += 1;
        result[key].total += 1;
        return result;
    }, {});

    return Object.values(summary).sort((left, right) => right.total - left.total);
}

function buildAutonomousResponseOverview(alerts = [], options = {}) {
    const config = getIncidentResponseConfig(options.env);
    const eligibleAlerts = alerts.filter((alert) => config.allowedSources.includes(String(alert.source || '')));
    const evaluatedAlerts = eligibleAlerts.filter((alert) => alert.response && alert.response.level);
    const actionRecords = evaluatedAlerts.flatMap((alert) => Array.isArray(alert.response.actions) ? alert.response.actions : []);
    const notifyCount = evaluatedAlerts.filter((alert) => alert.response.level === 'notify').length;
    const blockCount = evaluatedAlerts.filter((alert) => alert.response.level === 'block').length;
    const totalAlerts = eligibleAlerts.length || 1;
    const totalActions = actionRecords.length || 1;

    return {
        enabled: config.enabled,
        notifyThreshold: config.notifyThreshold,
        blockThreshold: config.blockThreshold,
        requireTrainedModelForBlock: config.requireTrainedModelForBlock,
        notifyOnImportantFeedback: config.notifyOnImportantFeedback,
        allowedSources: config.allowedSources,
        eligibleAlertCount: eligibleAlerts.length,
        evaluatedAlertCount: evaluatedAlerts.length,
        notifyDecisionCount: notifyCount,
        blockDecisionCount: blockCount,
        providers: [
            {
                label: 'Slack',
                configured: hasConfiguredValue((options.env || process.env).SLACK_WEBHOOK_URL)
            },
            {
                label: 'Email',
                configured: hasConfiguredValue((options.env || process.env).SMTP_HOST)
                    && hasConfiguredValue((options.env || process.env).ALERT_EMAIL_TO)
            },
            {
                label: 'Block Webhook',
                configured: hasConfiguredValue((options.env || process.env).BLOCK_WEBHOOK_URL)
                    && hasConfiguredValue((options.env || process.env).BLOCK_WEBHOOK_SECRET)
            }
        ],
        levelCounts: summarizeCounts(
            evaluatedAlerts,
            (alert) => alert.response && alert.response.level ? alert.response.level : 'unrecorded',
            ['block', 'notify', 'none', 'unrecorded']
        ).map((item) => ({
            ...item,
            proportion: Number((item.count / totalAlerts).toFixed(3))
        })),
        actionStatusCounts: summarizeCounts(
            actionRecords,
            (action) => action.status || 'unknown',
            ['sent', 'planned', 'skipped', 'failed']
        ).map((item) => ({
            ...item,
            proportion: Number((item.count / totalActions).toFixed(3))
        }))
    };
}

function buildModelSummary(model, pathValue) {
    if (!model) {
        return {
            available: false,
            path: pathValue,
            topPositiveFeatures: [],
            topNegativeFeatures: []
        };
    }

    const summary = MODEL_SUMMARY_FIELDS.reduce((result, key) => {
        result[key] = model[key];
        return result;
    }, {});

    return {
        available: true,
        path: pathValue,
        topPositiveFeatures: buildFeatureHighlights(model, 'positive'),
        topNegativeFeatures: buildFeatureHighlights(model, 'negative'),
        ...summary
    };
}

async function loadAlertsForOverview(userId) {
    return SecurityAlert.find({ user: userId })
        .select('type severity summary details feedback mlScore mlLabel mlReasons scoreSource response source detectedAt')
        .sort({ detectedAt: -1, createdAt: -1 })
        .lean();
}

async function loadRealTrainingExamples(options = {}) {
    const limit = Number.isFinite(Number(options.maxRealCount))
        ? Math.max(20, Number(options.maxRealCount))
        : 5000;

    const alerts = await SecurityAlert.find({})
        .select('type severity summary details feedback mlFeatures')
        .sort({ 'feedback.updatedAt': -1, updatedAt: -1, createdAt: -1 })
        .lean()
        .limit(limit);

    return alerts
        .map((alert) => buildTrainingExampleFromAlert(alert))
        .filter(Boolean);
}

async function refreshStoredAlertScores(model) {
    if (typeof SecurityAlert.bulkWrite !== 'function') {
        return 0;
    }

    const alerts = await SecurityAlert.find({})
        .select('type severity summary details feedback detectedAt')
        .lean();

    if (!alerts.length) {
        return 0;
    }

    const rescoredAlerts = enrichAlertsForTriage(alerts, { model });
    const operations = rescoredAlerts.map((alert) => ({
        updateOne: {
            filter: { _id: alert._id },
            update: {
                feedback: alert.feedback,
                mlScore: alert.mlScore,
                mlLabel: alert.mlLabel,
                mlReasons: alert.mlReasons,
                mlFeatures: alert.mlFeatures,
                scoreSource: alert.scoreSource
            }
        }
    }));

    encryptSecurityAlertBulkWriteOperations(operations);
    await SecurityAlert.bulkWrite(operations, { ordered: false });
    return operations.length;
}

async function buildAlertTriageModuleOverview(options = {}) {
    const userId = options.userId;
    const runtimeModel = getRuntimeModel(options);
    const modelPath = resolveAlertTriageModelPath(options.modelPath);
    const [userAlerts, realTrainingExamples] = await Promise.all([
        loadAlertsForOverview(userId),
        loadRealTrainingExamples(options)
    ]);

    const enrichedAlerts = enrichAlertsForTriage(userAlerts, { model: runtimeModel });
    const recentAlerts = enrichedAlerts.slice(0, RECENT_ALERT_LIMIT);
    const trainableUserAlerts = enrichedAlerts.filter((alert) => TRAINABLE_FEEDBACK_LABELS.includes(alert.feedback.label));
    const autonomy = buildAutonomousResponseOverview(enrichedAlerts, options);

    return {
        model: buildModelSummary(runtimeModel, modelPath),
        training: {
            currentUserTrainableCount: trainableUserAlerts.length,
            projectTrainableCount: realTrainingExamples.length,
            currentUserFeedbackCounts: summarizeCounts(
                enrichedAlerts,
                (alert) => alert.feedback && alert.feedback.label ? alert.feedback.label : 'unreviewed',
                ['important', 'needs_review', 'false_positive', 'resolved', 'unreviewed']
            ),
            projectFeedbackCounts: summarizeCounts(
                realTrainingExamples,
                (example) => example.feedbackLabel,
                ['important', 'needs_review', 'false_positive', 'resolved']
            )
        },
        alerts: {
            totalCount: enrichedAlerts.length,
            scoreLabelCounts: summarizeCounts(
                enrichedAlerts,
                (alert) => alert.mlLabel || 'unscored',
                ['high', 'medium', 'low']
            ),
            scoreSourceCounts: summarizeCounts(
                enrichedAlerts,
                (alert) => alert.scoreSource || 'unknown'
            ),
            scoreBuckets: buildScoreBuckets(enrichedAlerts),
            typePriorityBreakdown: buildAlertTypePriorityBreakdown(enrichedAlerts),
            recentAlerts
        },
        autonomy
    };
}

function summarizeTrainingExamples(examples = []) {
    return {
        sources: summarizeCounts(examples, (example) => example.source),
        labels: summarizeCounts(examples, (example) => example.feedbackLabel || String(example.label))
    };
}

async function trainAndPersistAlertTriageModel(options = {}) {
    const mode = options.mode === 'bootstrap' ? 'bootstrap' : 'mixed';
    const syntheticCount = Number.isFinite(Number(options.syntheticCount))
        ? Math.max(100, Math.min(Number(options.syntheticCount), 5000))
        : (mode === 'bootstrap' ? 1000 : 600);
    const minRealCount = Number.isFinite(Number(options.minRealCount))
        ? Math.max(20, Number(options.minRealCount))
        : 150;
    const realExamples = mode === 'bootstrap'
        ? []
        : await loadRealTrainingExamples(options);
    const syntheticExamples = mode === 'bootstrap' || realExamples.length < minRealCount
        ? generateSyntheticTrainingExamples({
            count: syntheticCount,
            seed: options.seed || 1337
        })
        : [];
    const allExamples = mode === 'bootstrap'
        ? syntheticExamples
        : [...realExamples, ...syntheticExamples];

    if (allExamples.length < 20) {
        throw new Error('Not enough labeled examples are available to train the model yet');
    }

    const model = trainAlertTriageModel(allExamples, options);
    const savedPath = saveAlertTriageModel(model, options);
    const rescoredAlerts = options.rescoreStoredAlerts === false
        ? 0
        : await refreshStoredAlertScores(model);
    const summary = summarizeTrainingExamples(allExamples);

    return {
        mode,
        savedPath,
        syntheticBootstrapped: syntheticExamples.length > 0,
        realExamples: realExamples.length,
        syntheticExamples: syntheticExamples.length,
        rescoredAlerts,
        model: buildModelSummary(model, savedPath),
        sources: summary.sources,
        labels: summary.labels
    };
}

module.exports = {
    TRAINABLE_FEEDBACK_LABELS,
    buildAlertTriageModuleOverview,
    loadRealTrainingExamples,
    trainAndPersistAlertTriageModel
};
