const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL_SCORE_SOURCE = 'trained-locator-repair-logistic-regression';
const DEFAULT_MODEL_PATH = path.resolve(__dirname, '../../artifacts/locator-repair-model.json');
const LABEL_HIGH_THRESHOLD = 0.78;
const LABEL_MEDIUM_THRESHOLD = 0.58;

const FEATURE_NAMES = [
    'heuristic_score_norm',
    'candidate_has_testid',
    'candidate_has_id',
    'candidate_has_href',
    'candidate_has_name',
    'candidate_has_placeholder',
    'candidate_has_accessible_name',
    'candidate_has_text',
    'candidate_role_link',
    'candidate_role_button',
    'candidate_role_textbox',
    'original_family_text',
    'original_family_role',
    'original_family_css',
    'original_family_id',
    'original_family_name',
    'original_family_placeholder',
    'exact_testid_match',
    'exact_id_match',
    'exact_href_match',
    'exact_name_match',
    'exact_placeholder_match',
    'exact_text_match',
    'role_match',
    'tag_match',
    'original_overlap_norm',
    'step_overlap_norm',
    'stable_signal_count_norm',
    'upgrade_text_to_testid',
    'upgrade_text_to_id_or_name',
    'candidate_text_length_norm'
];

const FEATURE_REASON_MESSAGES = {
    heuristic_score_norm: {
        positive: 'The trained reranker agreed with the deterministic scoring baseline.',
        negative: 'The trained reranker discounted the deterministic baseline for this candidate.'
    },
    candidate_has_testid: {
        positive: 'A dedicated data-testid strongly resembles previously accepted repairs.',
        negative: 'The lack of a dedicated data-testid lowered the learned confidence.'
    },
    candidate_has_id: {
        positive: 'A stable id often helped prior repair decisions.',
        negative: 'No stable id was available for this candidate.'
    },
    candidate_has_href: {
        positive: 'A stable href helped the learned model anchor navigation intent.',
        negative: 'The candidate did not expose a stable href.'
    },
    candidate_has_name: {
        positive: 'A semantic form name increased the learned confidence.',
        negative: 'The candidate did not expose a semantic name attribute.'
    },
    candidate_has_placeholder: {
        positive: 'A stable placeholder aligned with previous form-field repairs.',
        negative: 'No placeholder signal was available for this candidate.'
    },
    exact_testid_match: {
        positive: 'Matching a data-testid is one of the strongest learned repair signals.',
        negative: 'The candidate did not preserve the original data-testid signal.'
    },
    exact_id_match: {
        positive: 'Matching the original id is a strong learned indicator.',
        negative: 'The candidate did not preserve the original id signal.'
    },
    exact_href_match: {
        positive: 'Matching the original href strongly aligned with accepted navigation repairs.',
        negative: 'The candidate did not preserve the original href.'
    },
    exact_name_match: {
        positive: 'Matching the original name aligned with accepted form repairs.',
        negative: 'The candidate did not preserve the original name.'
    },
    exact_placeholder_match: {
        positive: 'Matching the original placeholder supported the learned repair decision.',
        negative: 'The candidate did not preserve the original placeholder.'
    },
    exact_text_match: {
        positive: 'Exact text continuity still helped when the visible label remained stable.',
        negative: 'The candidate did not keep the original visible text.'
    },
    role_match: {
        positive: 'Keeping the same role aligned with prior accepted repairs.',
        negative: 'The role drift reduced learned confidence.'
    },
    tag_match: {
        positive: 'Keeping the same DOM tag supported the repair decision.',
        negative: 'The tag changed from the original locator context.'
    },
    original_overlap_norm: {
        positive: 'The candidate retained tokens from the broken locator intent.',
        negative: 'The candidate shared very little with the original locator intent.'
    },
    step_overlap_norm: {
        positive: 'The candidate aligned closely with the natural-language step goal.',
        negative: 'The candidate did not align strongly with the step goal.'
    },
    stable_signal_count_norm: {
        positive: 'Multiple stable automation signals increased the learned confidence.',
        negative: 'The candidate exposed too few stable automation signals.'
    },
    upgrade_text_to_testid: {
        positive: 'Upgrading from text to a dedicated automation attribute strongly resembled accepted repairs.',
        negative: 'The candidate did not improve the original text-driven locator with a test id.'
    },
    upgrade_text_to_id_or_name: {
        positive: 'Upgrading from text to id or name aligned with successful self-heals.',
        negative: 'The candidate did not provide a stronger id-or-name upgrade.'
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

function resolveLocatorRepairModelPath(customPath) {
    if (customPath && String(customPath).trim()) {
        return path.resolve(customPath);
    }

    if (process.env.LOCATOR_REPAIR_MODEL_PATH && process.env.LOCATOR_REPAIR_MODEL_PATH.trim()) {
        return path.resolve(process.env.LOCATOR_REPAIR_MODEL_PATH.trim());
    }

    return DEFAULT_MODEL_PATH;
}

function vectorizeLocatorRepairFeatures(features = {}) {
    return [
        Math.min(Math.max(Number(features.heuristicScoreNorm) || 0, 0), 1),
        features.candidateHasDataTestId ? 1 : 0,
        features.candidateHasId ? 1 : 0,
        features.candidateHasHref ? 1 : 0,
        features.candidateHasName ? 1 : 0,
        features.candidateHasPlaceholder ? 1 : 0,
        features.candidateHasAccessibleName ? 1 : 0,
        features.candidateHasText ? 1 : 0,
        features.candidateRoleLink ? 1 : 0,
        features.candidateRoleButton ? 1 : 0,
        features.candidateRoleTextbox ? 1 : 0,
        features.originalFamilyText ? 1 : 0,
        features.originalFamilyRole ? 1 : 0,
        features.originalFamilyCss ? 1 : 0,
        features.originalFamilyId ? 1 : 0,
        features.originalFamilyName ? 1 : 0,
        features.originalFamilyPlaceholder ? 1 : 0,
        features.exactDataTestIdMatch ? 1 : 0,
        features.exactIdMatch ? 1 : 0,
        features.exactHrefMatch ? 1 : 0,
        features.exactNameMatch ? 1 : 0,
        features.exactPlaceholderMatch ? 1 : 0,
        features.exactTextMatch ? 1 : 0,
        features.roleMatch ? 1 : 0,
        features.tagMatch ? 1 : 0,
        normalizeBounded(features.originalOverlap, 5),
        normalizeBounded(features.stepOverlap, 5),
        normalizeBounded(features.stableSignalCount, 5),
        features.upgradeTextToDataTestId ? 1 : 0,
        features.upgradeTextToIdOrName ? 1 : 0,
        normalizeBounded(features.candidateTextLength, 64)
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

function clearLocatorRepairModelCache() {
    cachedModelPath = null;
    cachedModel = undefined;
}

function loadLocatorRepairModel(options = {}) {
    const resolvedPath = resolveLocatorRepairModelPath(options.modelPath);
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
        console.warn('[locator-repair-model] failed to load trained model:', error.message);
        cachedModel = null;
    }

    return cachedModel;
}

function saveLocatorRepairModel(model, options = {}) {
    const resolvedPath = resolveLocatorRepairModelPath(options.modelPath);
    const normalizedModel = normalizeLoadedModel(model);

    if (!normalizedModel) {
        throw new Error('Cannot save an invalid locator repair model');
    }

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${JSON.stringify(normalizedModel, null, 2)}\n`, 'utf8');
    clearLocatorRepairModelCache();
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
                ? 'The trained locator-repair model found a supporting signal.'
                : 'The trained locator-repair model found a dampening signal.';
        }

        return item.contribution >= 0 ? templates.positive : templates.negative;
    });

    if (reasons.length > 0) {
        return reasons;
    }

    return ['The trained locator-repair model estimated this candidate from prior repair outcomes.'];
}

function predictLocatorRepairCandidate(features = {}, model) {
    const normalizedModel = normalizeLoadedModel(model);
    if (!normalizedModel) {
        return null;
    }

    const featureVector = vectorizeLocatorRepairFeatures(features);
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

function evaluateLocatorRepairModel(model, examples = []) {
    const normalizedModel = normalizeLoadedModel(model);
    if (!normalizedModel) {
        throw new Error('A valid locator repair model is required for evaluation');
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
        const prediction = predictLocatorRepairCandidate(example.features, normalizedModel);
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
        accuracy: roundNumber(weightedCorrect / (totalWeight || 1), 4),
        precision: roundNumber(precision, 4),
        recall: roundNumber(recall, 4),
        loss: roundNumber(weightedLoss / (totalWeight || 1), 4)
    };
}

function trainLocatorRepairModel(examples = [], options = {}) {
    const safeExamples = Array.isArray(examples) ? examples.filter(Boolean) : [];
    if (safeExamples.length === 0) {
        throw new Error('At least one locator repair training example is required');
    }

    const learningRate = Number.isFinite(Number(options.learningRate))
        ? Number(options.learningRate)
        : 0.32;
    const epochs = Number.isFinite(Number(options.epochs))
        ? Math.max(60, Number(options.epochs))
        : 420;
    const regularization = Number.isFinite(Number(options.regularization))
        ? Math.max(0, Number(options.regularization))
        : 0.0012;

    const normalizedExamples = safeExamples.map((example) => ({
        features: example.features,
        vector: vectorizeLocatorRepairFeatures(example.features),
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

    model.metrics = evaluateLocatorRepairModel(model, normalizedExamples);
    return model;
}

module.exports = {
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    clearLocatorRepairModelCache,
    evaluateLocatorRepairModel,
    labelFromProbability,
    loadLocatorRepairModel,
    predictLocatorRepairCandidate,
    resolveLocatorRepairModelPath,
    saveLocatorRepairModel,
    trainLocatorRepairModel,
    vectorizeLocatorRepairFeatures
};
