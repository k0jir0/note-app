const SecurityAlert = require('../models/SecurityAlert');
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

function buildModelSummary(model, pathValue) {
    if (!model) {
        return {
            available: false,
            path: pathValue
        };
    }

    const summary = MODEL_SUMMARY_FIELDS.reduce((result, key) => {
        result[key] = model[key];
        return result;
    }, {});

    return {
        available: true,
        path: pathValue,
        ...summary
    };
}

async function loadAlertsForOverview(userId) {
    return SecurityAlert.find({ user: userId })
        .select('type severity summary details feedback mlScore mlLabel mlReasons scoreSource detectedAt')
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
            recentAlerts
        }
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
