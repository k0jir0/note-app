const fs = require('fs');
const path = require('path');

const ALERT_TYPES = [
    'failed_login_burst',
    'suspicious_path_probe',
    'high_error_rate',
    'scanner_tool_detected',
    'injection_attempt',
    'directory_enumeration'
];

const ALERT_SEVERITIES = ['low', 'medium', 'high'];
const DEFAULT_MODEL_SCORE_SOURCE = 'trained-logistic-regression';
const DEFAULT_MODEL_PATH = path.resolve(__dirname, '../../artifacts/alert-triage-model.json');
const LABEL_HIGH_THRESHOLD = 0.75;
const LABEL_MEDIUM_THRESHOLD = 0.45;

const FEATURE_NAMES = [
    'count_norm',
    'threshold_norm',
    'ratio_norm',
    'sample_size_norm',
    'tool_count_norm',
    'source_ip_count_norm',
    'summary_length_norm',
    'has_ip_indicator',
    'has_fingerprint',
    ...ALERT_SEVERITIES.map((severity) => `severity_${severity}`),
    ...ALERT_TYPES.map((type) => `type_${type}`),
    'type_unknown'
];

const FEATURE_REASON_MESSAGES = {
    count_norm: {
        positive: 'The trained model learned that repeated activity volume raises priority',
        negative: 'The trained model sees lower activity volume than analysts usually prioritize'
    },
    threshold_norm: {
        positive: 'The activity is materially above its triggering threshold',
        negative: 'The activity is only slightly above its triggering threshold'
    },
    ratio_norm: {
        positive: 'The observed failure or enumeration ratio strongly resembles higher-risk alerts',
        negative: 'The observed failure or enumeration ratio looks closer to lower-risk alerts'
    },
    sample_size_norm: {
        positive: 'The alert includes enough repeated evidence to resemble analyst-confirmed cases',
        negative: 'The alert contains less repeated evidence than analyst-confirmed cases'
    },
    tool_count_norm: {
        positive: 'Recognized scanner tooling is strongly associated with higher-priority alerts',
        negative: 'No strong scanner-tool signal was present in the learned feature mix'
    },
    source_ip_count_norm: {
        positive: 'Multi-source activity patterns increased the learned risk score',
        negative: 'The source spread looks narrower than patterns analysts usually escalate'
    },
    summary_length_norm: {
        positive: 'Richer alert context nudged the learned score upward',
        negative: 'The alert context is sparse compared with analyst-prioritized alerts'
    },
    has_ip_indicator: {
        positive: 'A concrete IP indicator increased confidence in this alert',
        negative: 'The absence of a concrete IP indicator reduced the learned score'
    },
    has_fingerprint: {
        positive: 'A stable fingerprint resembles previously labeled security events',
        negative: 'No stable fingerprint signal was available for the learned model'
    },
    severity_low: {
        positive: 'Low severity unexpectedly contributed to the learned score',
        negative: 'Low severity pulled the learned score down'
    },
    severity_medium: {
        positive: 'Medium severity aligns with previously escalated alerts',
        negative: 'Medium severity did not strongly match escalated alerts'
    },
    severity_high: {
        positive: 'High severity strongly matches previously escalated alerts',
        negative: 'High severity was less predictive than other features in the trained model'
    },
    type_failed_login_burst: {
        positive: 'Failed-login bursts were often escalated in prior feedback',
        negative: 'Failed-login bursts were often deprioritized in prior feedback'
    },
    type_suspicious_path_probe: {
        positive: 'Reconnaissance-style path probing often led to escalation in prior feedback',
        negative: 'Reconnaissance-style path probing was often treated as lower priority'
    },
    type_high_error_rate: {
        positive: 'High server error rates often coincided with analyst-prioritized incidents',
        negative: 'High server error rates often resolved without escalation'
    },
    type_scanner_tool_detected: {
        positive: 'Known scanner activity correlated with analyst-prioritized events',
        negative: 'Known scanner activity often looked noisy in prior feedback'
    },
    type_injection_attempt: {
        positive: 'Injection-attempt patterns were strongly associated with escalation',
        negative: 'Injection-attempt patterns were less predictive than expected in prior feedback'
    },
    type_directory_enumeration: {
        positive: 'Directory-enumeration patterns frequently led to escalation',
        negative: 'Directory-enumeration patterns often looked like noise in prior feedback'
    },
    type_unknown: {
        positive: 'Unrecognized alert types still matched some higher-risk learned patterns',
        negative: 'Unrecognized alert types were usually treated conservatively'
    }
};

let cachedModelPath = null;
let cachedModel = undefined;

function clampProbability(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0.001, Math.min(0.999, value));
}

function roundNumber(value, digits = 6) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Number(value.toFixed(digits));
}

function sigmoid(value) {
    if (value >= 0) {
        const z = Math.exp(-value);
        return 1 / (1 + z);
    }

    const z = Math.exp(value);
    return z / (1 + z);
}

function normalizeBounded(value, maxValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
    }

    return Math.min(parsed / maxValue, 1);
}

function labelFromProbability(score) {
    if (score >= LABEL_HIGH_THRESHOLD) {
        return 'high';
    }

    return score >= LABEL_MEDIUM_THRESHOLD ? 'medium' : 'low';
}

function dotProduct(left = [], right = []) {
    return left.reduce((sum, value, index) => sum + (value * (right[index] || 0)), 0);
}

function resolveAlertTriageModelPath(customPath) {
    if (customPath && String(customPath).trim()) {
        return path.resolve(customPath);
    }

    if (process.env.ALERT_TRIAGE_MODEL_PATH && process.env.ALERT_TRIAGE_MODEL_PATH.trim()) {
        return path.resolve(process.env.ALERT_TRIAGE_MODEL_PATH.trim());
    }

    return DEFAULT_MODEL_PATH;
}

function vectorizeAlertFeatures(features = {}) {
    const safeSeverity = ALERT_SEVERITIES.includes(features.severity)
        ? features.severity
        : null;
    const safeType = ALERT_TYPES.includes(features.type)
        ? features.type
        : 'unknown';

    return [
        normalizeBounded(features.count, 25),
        normalizeBounded(features.threshold, 10),
        Math.min(Math.max(Number(features.ratio) || 0, 0), 1),
        normalizeBounded(features.sampleSize, 5),
        normalizeBounded(features.toolCount, 3),
        normalizeBounded(features.sourceIpCount, 6),
        normalizeBounded(features.summaryLength, 200),
        features.hasIpIndicator ? 1 : 0,
        features.hasFingerprint ? 1 : 0,
        ...ALERT_SEVERITIES.map((severity) => (safeSeverity === severity ? 1 : 0)),
        ...ALERT_TYPES.map((type) => (safeType === type ? 1 : 0)),
        safeType === 'unknown' ? 1 : 0
    ];
}

function isValidModelPayload(model) {
    return Boolean(
        model &&
        Array.isArray(model.weights) &&
        Array.isArray(model.featureNames) &&
        model.weights.length === FEATURE_NAMES.length &&
        model.featureNames.length === FEATURE_NAMES.length &&
        Number.isFinite(Number(model.bias))
    );
}

function normalizeLoadedModel(payload) {
    if (!isValidModelPayload(payload)) {
        return null;
    }

    return {
        version: Number(payload.version) || 1,
        modelType: String(payload.modelType || 'logistic-regression'),
        scoreSource: String(payload.scoreSource || DEFAULT_MODEL_SCORE_SOURCE),
        trainedAt: payload.trainedAt ? String(payload.trainedAt) : null,
        featureNames: FEATURE_NAMES.slice(),
        bias: Number(payload.bias),
        weights: payload.weights.map((weight) => Number(weight)),
        trainingSamples: Number(payload.trainingSamples) || 0,
        positiveSamples: Number(payload.positiveSamples) || 0,
        negativeSamples: Number(payload.negativeSamples) || 0,
        metrics: payload.metrics && typeof payload.metrics === 'object'
            ? payload.metrics
            : {},
        sources: payload.sources && typeof payload.sources === 'object'
            ? payload.sources
            : {}
    };
}

function clearAlertTriageModelCache() {
    cachedModelPath = null;
    cachedModel = undefined;
}

function loadAlertTriageModel(options = {}) {
    const resolvedPath = resolveAlertTriageModelPath(options.modelPath);
    if (cachedModelPath === resolvedPath && cachedModel !== undefined) {
        return cachedModel;
    }

    cachedModelPath = resolvedPath;

    if (!fs.existsSync(resolvedPath)) {
        cachedModel = null;
        return cachedModel;
    }

    try {
        const payload = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        cachedModel = normalizeLoadedModel(payload);
    } catch (error) {
        console.warn('[alert-triage-model] failed to load trained model:', error.message);
        cachedModel = null;
    }

    return cachedModel;
}

function saveAlertTriageModel(model, options = {}) {
    const resolvedPath = resolveAlertTriageModelPath(options.modelPath);
    const normalizedModel = normalizeLoadedModel(model);

    if (!normalizedModel) {
        throw new Error('Cannot save an invalid alert triage model');
    }

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${JSON.stringify(normalizedModel, null, 2)}\n`, 'utf8');
    clearAlertTriageModelCache();
    return resolvedPath;
}

function buildModelReasons(vector, model, maxReasons = 3) {
    const contributions = model.weights
        .map((weight, index) => ({
            name: FEATURE_NAMES[index],
            contribution: Number(weight) * Number(vector[index] || 0)
        }))
        .filter((item) => Math.abs(item.contribution) >= 0.01)
        .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));

    const reasons = contributions.slice(0, maxReasons).map((item) => {
        const templates = FEATURE_REASON_MESSAGES[item.name];
        if (!templates) {
            return item.contribution >= 0
                ? 'The trained model found a positive supporting signal'
                : 'The trained model found a dampening signal';
        }

        return item.contribution >= 0 ? templates.positive : templates.negative;
    });

    if (reasons.length > 0) {
        return reasons;
    }

    return ['The trained model used prior analyst feedback to estimate this alert score'];
}

function predictAlertTriageFromFeatures(features = {}, model) {
    const normalizedModel = normalizeLoadedModel(model);
    if (!normalizedModel) {
        return null;
    }

    const featureVector = vectorizeAlertFeatures(features);
    const linearScore = dotProduct(featureVector, normalizedModel.weights) + normalizedModel.bias;
    const probability = clampProbability(sigmoid(linearScore));
    const roundedProbability = roundNumber(probability, 3);

    return {
        score: roundedProbability,
        label: labelFromProbability(roundedProbability),
        reasons: buildModelReasons(featureVector, normalizedModel),
        scoreSource: normalizedModel.scoreSource,
        featureVector
    };
}

function evaluateAlertTriageModel(model, examples = []) {
    const normalizedModel = normalizeLoadedModel(model);
    if (!normalizedModel) {
        throw new Error('A valid model is required for evaluation');
    }

    const safeExamples = Array.isArray(examples) ? examples : [];
    if (safeExamples.length === 0) {
        return {
            accuracy: 0,
            precision: 0,
            recall: 0,
            loss: 0
        };
    }

    let totalWeight = 0;
    let weightedCorrect = 0;
    let weightedTruePositive = 0;
    let weightedFalsePositive = 0;
    let weightedFalseNegative = 0;
    let weightedLoss = 0;

    safeExamples.forEach((example) => {
        const weight = Number(example.weight);
        const sampleWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
        const label = Number(example.label) > 0 ? 1 : 0;
        const prediction = predictAlertTriageFromFeatures(example.features, normalizedModel);
        const probability = prediction ? prediction.score : 0;
        const predictedLabel = probability >= 0.5 ? 1 : 0;

        totalWeight += sampleWeight;
        weightedLoss += sampleWeight * (
            (-label * Math.log(probability)) -
            ((1 - label) * Math.log(1 - probability))
        );

        if (predictedLabel === label) {
            weightedCorrect += sampleWeight;
        }

        if (predictedLabel === 1 && label === 1) {
            weightedTruePositive += sampleWeight;
        } else if (predictedLabel === 1 && label === 0) {
            weightedFalsePositive += sampleWeight;
        } else if (predictedLabel === 0 && label === 1) {
            weightedFalseNegative += sampleWeight;
        }
    });

    const precision = weightedTruePositive + weightedFalsePositive > 0
        ? weightedTruePositive / (weightedTruePositive + weightedFalsePositive)
        : 0;
    const recall = weightedTruePositive + weightedFalseNegative > 0
        ? weightedTruePositive / (weightedTruePositive + weightedFalseNegative)
        : 0;

    return {
        accuracy: roundNumber(weightedCorrect / totalWeight, 4),
        precision: roundNumber(precision, 4),
        recall: roundNumber(recall, 4),
        loss: roundNumber(weightedLoss / totalWeight, 4)
    };
}

function trainAlertTriageModel(examples = [], options = {}) {
    const safeExamples = Array.isArray(examples) ? examples.filter(Boolean) : [];
    if (safeExamples.length === 0) {
        throw new Error('At least one training example is required');
    }

    const learningRate = Number.isFinite(Number(options.learningRate))
        ? Number(options.learningRate)
        : 0.35;
    const epochs = Number.isFinite(Number(options.epochs))
        ? Math.max(50, Number(options.epochs))
        : 450;
    const regularization = Number.isFinite(Number(options.regularization))
        ? Math.max(0, Number(options.regularization))
        : 0.0015;

    const normalizedExamples = safeExamples.map((example) => ({
        features: example.features,
        vector: vectorizeAlertFeatures(example.features),
        label: Number(example.label) > 0 ? 1 : 0,
        weight: Number.isFinite(Number(example.weight)) && Number(example.weight) > 0
            ? Number(example.weight)
            : 1,
        source: example.source || 'unknown'
    }));

    const positiveWeight = normalizedExamples
        .filter((example) => example.label === 1)
        .reduce((sum, example) => sum + example.weight, 0);
    const negativeWeight = normalizedExamples
        .filter((example) => example.label === 0)
        .reduce((sum, example) => sum + example.weight, 0);
    const initialRate = positiveWeight + negativeWeight > 0
        ? clampProbability(positiveWeight / (positiveWeight + negativeWeight))
        : 0.5;

    let bias = Math.log(initialRate / (1 - initialRate));
    let weights = FEATURE_NAMES.map(() => 0);

    for (let epoch = 0; epoch < epochs; epoch += 1) {
        const gradients = FEATURE_NAMES.map(() => 0);
        let biasGradient = 0;
        let totalWeight = 0;

        normalizedExamples.forEach((example) => {
            const prediction = sigmoid(dotProduct(example.vector, weights) + bias);
            const error = prediction - example.label;

            totalWeight += example.weight;
            biasGradient += error * example.weight;

            example.vector.forEach((featureValue, index) => {
                gradients[index] += error * featureValue * example.weight;
            });
        });

        const safeWeight = totalWeight || 1;
        bias -= learningRate * (biasGradient / safeWeight);
        weights = weights.map((weight, index) => {
            const normalizedGradient = gradients[index] / safeWeight;
            return weight - learningRate * (normalizedGradient + (regularization * weight));
        });
    }

    const sourceCounts = normalizedExamples.reduce((counts, example) => {
        counts[example.source] = (counts[example.source] || 0) + 1;
        return counts;
    }, {});

    const model = {
        version: 1,
        modelType: 'logistic-regression',
        scoreSource: DEFAULT_MODEL_SCORE_SOURCE,
        trainedAt: new Date().toISOString(),
        featureNames: FEATURE_NAMES.slice(),
        bias: roundNumber(bias),
        weights: weights.map((weight) => roundNumber(weight)),
        trainingSamples: normalizedExamples.length,
        positiveSamples: normalizedExamples.filter((example) => example.label === 1).length,
        negativeSamples: normalizedExamples.filter((example) => example.label === 0).length,
        metrics: {},
        sources: sourceCounts
    };

    model.metrics = evaluateAlertTriageModel(model, normalizedExamples);
    return model;
}

module.exports = {
    ALERT_SEVERITIES,
    ALERT_TYPES,
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    clearAlertTriageModelCache,
    evaluateAlertTriageModel,
    labelFromProbability,
    loadAlertTriageModel,
    predictAlertTriageFromFeatures,
    resolveAlertTriageModelPath,
    saveAlertTriageModel,
    trainAlertTriageModel,
    vectorizeAlertFeatures
};
