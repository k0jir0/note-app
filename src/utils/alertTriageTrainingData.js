const { buildAlertFeatureSnapshot, normalizeFeedback } = require('./alertTriage');
const { ALERT_SEVERITIES, ALERT_TYPES } = require('./alertTriageModel');

const TRAINABLE_FEEDBACK_CONFIG = {
    important: { label: 1, weight: 1.2 },
    needs_review: { label: 1, weight: 0.85 },
    false_positive: { label: 0, weight: 1.1 },
    resolved: { label: 0, weight: 0.75 }
};

const SCANNER_TOOLS = ['nikto', 'sqlmap', 'masscan', 'gobuster', 'wfuzz', 'nessus'];

function createSeededRandom(seed = 1337) {
    let state = Number(seed) >>> 0;
    if (state === 0) {
        state = 1;
    }

    return () => {
        state = ((state * 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function randomInt(random, min, max) {
    return Math.floor(random() * ((max - min) + 1)) + min;
}

function randomFloat(random, min, max, digits = 2) {
    const value = min + (random() * (max - min));
    return Number(value.toFixed(digits));
}

function pickOne(random, values) {
    return values[randomInt(random, 0, values.length - 1)];
}

function buildSourceIps(count, seedOffset = 0) {
    const sourceIps = {};

    for (let index = 0; index < count; index += 1) {
        sourceIps[`203.0.113.${((seedOffset + index) % 200) + 1}`] = Math.max(1, count - index);
    }

    return sourceIps;
}

function buildSyntheticSummary(type, severity, riskScore) {
    const suffix = riskScore >= 0.8
        ? 'Analyst-style signal is strongly present.'
        : (riskScore >= 0.5
            ? 'Escalation indicators are mixed but notable.'
            : 'Signal is present but may be noisy.');

    return `${type.replaceAll('_', ' ')} detected at ${severity} severity. ${suffix}`;
}

function computeSyntheticRisk(features) {
    const severityWeight = {
        low: 0.04,
        medium: 0.16,
        high: 0.28
    }[features.severity] || 0.05;

    const typeWeight = {
        failed_login_burst: 0.12,
        suspicious_path_probe: 0.16,
        high_error_rate: 0.09,
        scanner_tool_detected: 0.1,
        injection_attempt: 0.24,
        directory_enumeration: 0.15
    }[features.type] || 0.05;

    let risk = 0.08;
    risk += severityWeight;
    risk += typeWeight;
    risk += Math.min(features.count / 40, 0.14);
    risk += Math.min(features.ratio, 0.16);
    risk += Math.min(features.toolCount * 0.04, 0.12);
    risk += Math.min(features.sourceIpCount * 0.018, 0.09);
    risk += features.hasFingerprint ? 0.04 : 0;
    risk += features.hasIpIndicator ? 0.03 : 0;

    if (features.type === 'injection_attempt' && features.ratio >= 0.2) {
        risk += 0.08;
    }

    if (features.type === 'failed_login_burst' && features.count >= 12) {
        risk += 0.05;
    }

    if (features.type === 'scanner_tool_detected' && features.toolCount >= 2) {
        risk += 0.05;
    }

    if (features.type === 'high_error_rate' && features.ratio < 0.25) {
        risk -= 0.08;
    }

    return Math.max(0.01, Math.min(0.99, Number(risk.toFixed(3))));
}

function resolveSyntheticFeedbackLabel(riskScore, random) {
    const jitter = (random() - 0.5) * 0.12;
    const adjustedRisk = Math.max(0, Math.min(1, riskScore + jitter));

    if (adjustedRisk >= 0.8) {
        return 'important';
    }

    if (adjustedRisk >= 0.55) {
        return 'needs_review';
    }

    if (adjustedRisk <= 0.18) {
        return 'false_positive';
    }

    return 'resolved';
}

function buildSyntheticDetails(type, severity, random, index) {
    const count = type === 'failed_login_burst'
        ? randomInt(random, 5, 20)
        : randomInt(random, 1, severity === 'high' ? 18 : 12);
    const threshold = type === 'failed_login_burst' ? 5 : randomInt(random, 2, 8);
    const ratio = type === 'high_error_rate' || type === 'directory_enumeration'
        ? randomFloat(random, 0.12, 0.85)
        : randomFloat(random, 0, 0.45);
    const sampleSize = randomInt(random, 1, 4);
    const sourceIpCount = type === 'failed_login_burst'
        ? randomInt(random, 1, 2)
        : randomInt(random, 1, 5);
    const toolCount = type === 'scanner_tool_detected' || type === 'suspicious_path_probe'
        ? randomInt(random, 0, 3)
        : (type === 'injection_attempt' ? randomInt(random, 0, 1) : 0);

    const sample = Array.from({ length: sampleSize }, (_, lineIndex) => `sample-line-${index}-${lineIndex}`);
    const tools = Array.from({ length: toolCount }, (_, toolIndex) => SCANNER_TOOLS[(index + toolIndex) % SCANNER_TOOLS.length]);
    const details = {
        count,
        threshold,
        ratio,
        sample,
        sourceIps: buildSourceIps(sourceIpCount, index),
        tools
    };

    if (type === 'failed_login_burst' || type === 'injection_attempt' || severity === 'high') {
        details.ip = `198.51.100.${(index % 200) + 1}`;
    }

    if (random() > 0.55) {
        details._fingerprint = `synthetic-fingerprint-${index}`;
    }

    return details;
}

function createSyntheticAlert(index, random) {
    const type = pickOne(random, ALERT_TYPES);
    const severity = pickOne(random, ALERT_SEVERITIES);
    const details = buildSyntheticDetails(type, severity, random, index);
    const provisionalAlert = {
        type,
        severity,
        summary: `${type.replaceAll('_', ' ')} synthetic placeholder`,
        details,
        feedback: { label: 'unreviewed' }
    };
    const features = buildAlertFeatureSnapshot(provisionalAlert);
    const riskScore = computeSyntheticRisk(features);
    const feedbackLabel = resolveSyntheticFeedbackLabel(riskScore, random);

    return {
        type,
        severity,
        summary: buildSyntheticSummary(type, severity, riskScore),
        details,
        feedback: {
            label: feedbackLabel,
            updatedAt: new Date('2026-03-21T12:00:00.000Z')
        }
    };
}

function buildTrainingExampleFromAlert(alert = {}) {
    const feedback = normalizeFeedback(alert.feedback);
    const config = TRAINABLE_FEEDBACK_CONFIG[feedback.label];
    if (!config) {
        return null;
    }

    const features = alert.mlFeatures && typeof alert.mlFeatures === 'object' && Object.keys(alert.mlFeatures).length > 0
        ? alert.mlFeatures
        : buildAlertFeatureSnapshot({
            ...alert,
            feedback
        });

    return {
        features,
        label: config.label,
        weight: config.weight,
        feedbackLabel: feedback.label,
        source: 'analyst-feedback'
    };
}

function generateSyntheticTrainingExamples(options = {}) {
    const count = Number.isFinite(Number(options.count))
        ? Math.max(1, Number(options.count))
        : 600;
    const random = createSeededRandom(options.seed || 1337);
    const examples = [];

    for (let index = 0; index < count; index += 1) {
        const alert = createSyntheticAlert(index, random);
        const example = buildTrainingExampleFromAlert(alert);
        if (example) {
            example.source = 'synthetic-bootstrap';
            examples.push(example);
        }
    }

    return examples;
}

module.exports = {
    TRAINABLE_FEEDBACK_CONFIG,
    buildTrainingExampleFromAlert,
    generateSyntheticTrainingExamples
};
