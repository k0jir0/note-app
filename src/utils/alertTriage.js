const {
    loadAlertTriageModel,
    predictAlertTriageFromFeatures
} = require('./alertTriageModel');

const VALID_FEEDBACK_LABELS = [
    'unreviewed',
    'important',
    'needs_review',
    'false_positive',
    'resolved'
];

const SEVERITY_WEIGHTS = {
    low: 0.08,
    medium: 0.2,
    high: 0.34
};

const TYPE_WEIGHTS = {
    failed_login_burst: 0.14,
    suspicious_path_probe: 0.16,
    high_error_rate: 0.1,
    scanner_tool_detected: 0.12,
    injection_attempt: 0.28,
    directory_enumeration: 0.18
};

function clampScore(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(0.99, value));
}

function normalizeDate(value) {
    if (!value) {
        return null;
    }

    const normalized = new Date(value);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function normalizeFeedback(feedback = {}) {
    const label = VALID_FEEDBACK_LABELS.includes(feedback.label)
        ? feedback.label
        : 'unreviewed';

    return {
        label,
        updatedAt: normalizeDate(feedback.updatedAt)
    };
}

function readNumericDetail(details = {}, key) {
    const parsed = Number(details[key]);
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildAlertFeatureSnapshot(alert = {}) {
    const details = alert && alert.details ? alert.details : {};
    const sample = Array.isArray(details.sample) ? details.sample : [];
    const tools = Array.isArray(details.tools) ? details.tools : [];
    const sourceIps = details.sourceIps && typeof details.sourceIps === 'object'
        ? Object.keys(details.sourceIps)
        : [];
    const feedback = normalizeFeedback(alert.feedback);
    const ratio = readNumericDetail(details, 'ratio');
    const count = readNumericDetail(details, 'count');

    return {
        type: String(alert.type || 'unknown'),
        severity: String(alert.severity || 'low'),
        count,
        threshold: readNumericDetail(details, 'threshold'),
        ratio,
        sampleSize: sample.length,
        toolCount: tools.length,
        sourceIpCount: sourceIps.length + (details.ip ? 1 : 0),
        summaryLength: String(alert.summary || '').length,
        hasIpIndicator: Boolean(details.ip),
        hasFingerprint: Boolean(details._fingerprint),
        feedbackLabel: feedback.label
    };
}

function buildFeedbackReasons(feedback) {
    const reasons = [];

    if (feedback.label === 'important') {
        reasons.push('Analyst marked this alert as important');
    } else if (feedback.label === 'needs_review') {
        reasons.push('Analyst marked this alert for follow-up review');
    }

    if (feedback.label === 'false_positive') {
        reasons.push('Analyst marked this alert as a false positive');
    }

    if (feedback.label === 'resolved') {
        reasons.push('Analyst marked this alert as resolved');
    }

    return reasons;
}

function buildHeuristicReasons(features) {
    const reasons = [];

    if (features.severity === 'high') {
        reasons.push('Alert severity is high');
    }

    if (features.ratio >= 0.4) {
        reasons.push('Observed error or enumeration ratio is elevated');
    }

    if (features.count >= 10) {
        reasons.push('Repeated activity volume is well above the rule threshold');
    }

    if (features.type === 'injection_attempt') {
        reasons.push('Injection attempts are prioritized over generic noise');
    }

    if (features.type === 'directory_enumeration' || features.type === 'suspicious_path_probe') {
        reasons.push('Reconnaissance behavior often correlates with exposed web services');
    }

    if (features.toolCount > 0) {
        reasons.push('Known scanner tooling was detected in the alert context');
    }

    return reasons.slice(0, 4);
}

function labelFromScore(score) {
    if (score >= 0.75) {
        return 'high';
    }

    return score >= 0.45 ? 'medium' : 'low';
}

function computeHeuristicScore(features) {
    let score = 0.14;
    score += SEVERITY_WEIGHTS[features.severity] || 0.05;
    score += TYPE_WEIGHTS[features.type] || 0.05;
    score += Math.min(features.count / 25, 0.12);
    score += Math.min(features.ratio, 0.18);
    score += Math.min(features.toolCount * 0.03, 0.09);
    score += Math.min(features.sourceIpCount * 0.02, 0.08);

    if (features.summaryLength > 120) {
        score += 0.03;
    }

    const normalizedScore = Number(clampScore(score).toFixed(3));
    return {
        score: normalizedScore,
        label: labelFromScore(normalizedScore),
        reasons: buildHeuristicReasons(features),
        scoreSource: 'heuristic-baseline'
    };
}

function applyFeedbackOverride(baseTriage, feedback) {
    let score = baseTriage.score;

    if (feedback.label === 'important') {
        score = Math.max(score, 0.95);
    } else if (feedback.label === 'needs_review') {
        score = Math.max(score, 0.58);
    } else if (feedback.label === 'false_positive') {
        score = Math.min(score, 0.05);
    } else if (feedback.label === 'resolved') {
        score = Math.min(score, 0.18);
    }

    const normalizedScore = Number(clampScore(score).toFixed(3));
    const feedbackReasons = buildFeedbackReasons(feedback);
    const reasons = [...feedbackReasons, ...(baseTriage.reasons || [])]
        .filter(Boolean)
        .filter((reason, index, items) => items.indexOf(reason) === index)
        .slice(0, 4);

    return {
        feedback,
        score: normalizedScore,
        label: labelFromScore(normalizedScore),
        reasons,
        scoreSource: feedbackReasons.length > 0
            ? `${baseTriage.scoreSource}+analyst-feedback`
            : baseTriage.scoreSource
    };
}

function resolveRuntimeModel(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'model')) {
        return options.model;
    }

    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_ALERT_TRIAGE_MODEL === '1') {
        return null;
    }

    return loadAlertTriageModel();
}

function computeAlertTriage(alert = {}, options = {}) {
    const feedback = normalizeFeedback(alert.feedback);
    const features = buildAlertFeatureSnapshot({
        ...alert,
        feedback
    });
    const model = resolveRuntimeModel(options);
    const modelPrediction = model
        ? predictAlertTriageFromFeatures(features, model)
        : null;
    const baseTriage = modelPrediction || computeHeuristicScore(features);
    const triage = applyFeedbackOverride(baseTriage, feedback);

    return {
        feedback: triage.feedback,
        score: triage.score,
        label: triage.label,
        reasons: triage.reasons,
        features,
        scoreSource: triage.scoreSource
    };
}

function enrichAlertForTriage(alert = {}, options = {}) {
    const triage = computeAlertTriage(alert, options);

    return {
        ...alert,
        feedback: triage.feedback,
        mlScore: triage.score,
        mlLabel: triage.label,
        mlReasons: triage.reasons,
        mlFeatures: triage.features,
        scoreSource: triage.scoreSource
    };
}

function enrichAlertsForTriage(alerts = [], options = {}) {
    return alerts.map((alert) => enrichAlertForTriage(alert, options));
}

module.exports = {
    VALID_FEEDBACK_LABELS,
    buildAlertFeatureSnapshot,
    computeAlertTriage,
    enrichAlertForTriage,
    enrichAlertsForTriage,
    normalizeFeedback
};
