const { expect } = require('chai');

const {
    VALID_FEEDBACK_LABELS,
    buildAlertFeatureSnapshot,
    computeAlertTriage,
    enrichAlertForTriage,
    normalizeFeedback
} = require('../src/utils/alertTriage');
const { FEATURE_NAMES } = require('../src/utils/alertTriageModel');

describe('Alert triage utilities', () => {
    it('normalizes feedback labels and invalid dates safely', () => {
        const feedback = normalizeFeedback({
            label: 'important',
            updatedAt: 'not-a-date'
        });

        expect(VALID_FEEDBACK_LABELS).to.include('important');
        expect(feedback.label).to.equal('important');
        expect(feedback.updatedAt).to.equal(null);
    });

    it('builds a feature snapshot from alert details', () => {
        const features = buildAlertFeatureSnapshot({
            type: 'directory_enumeration',
            severity: 'medium',
            summary: 'Enumeration likely in progress',
            details: {
                count: 12,
                ratio: 0.5,
                sample: ['line1', 'line2'],
                sourceIps: { '10.0.0.4': 8, '10.0.0.5': 4 }
            }
        });

        expect(features.count).to.equal(12);
        expect(features.ratio).to.equal(0.5);
        expect(features.sampleSize).to.equal(2);
        expect(features.sourceIpCount).to.equal(2);
    });

    it('boosts the score when an analyst marks an alert as important', () => {
        const triage = computeAlertTriage({
            type: 'failed_login_burst',
            severity: 'medium',
            summary: 'Repeated failed logins from one source',
            details: { count: 8, threshold: 5 },
            feedback: { label: 'important', updatedAt: new Date() }
        });

        expect(triage.score).to.be.greaterThan(0.9);
        expect(triage.label).to.equal('high');
        expect(triage.reasons[0]).to.equal('Analyst marked this alert as important');
    });

    it('enriches an alert with score, reasons, and feedback state', () => {
        const alert = enrichAlertForTriage({
            type: 'injection_attempt',
            severity: 'high',
            summary: 'Potential SQL injection attempt',
            details: { count: 6, sourceIps: { '10.0.0.7': 6 } }
        });

        expect(alert.feedback.label).to.equal('unreviewed');
        expect(alert.mlScore).to.be.greaterThan(0.5);
        expect(alert.mlLabel).to.equal('high');
        expect(alert.scoreSource).to.equal('heuristic-baseline');
        expect(alert.mlReasons).to.be.an('array').that.is.not.empty;
    });

    it('uses a trained model when one is provided explicitly', () => {
        const weights = FEATURE_NAMES.map(() => 0);
        weights[FEATURE_NAMES.indexOf('count_norm')] = 1.1;
        weights[FEATURE_NAMES.indexOf('severity_high')] = 1.5;
        weights[FEATURE_NAMES.indexOf('type_injection_attempt')] = 2.1;

        const triage = computeAlertTriage({
            type: 'injection_attempt',
            severity: 'high',
            summary: 'Potential SQL injection attempt',
            details: { count: 6, sourceIps: { '10.0.0.7': 6 } }
        }, {
            model: {
                version: 1,
                modelType: 'logistic-regression',
                scoreSource: 'trained-logistic-regression',
                featureNames: FEATURE_NAMES.slice(),
                bias: -1.1,
                weights
            }
        });

        expect(triage.scoreSource).to.equal('trained-logistic-regression');
        expect(triage.score).to.be.greaterThan(0.7);
        expect(triage.reasons).to.be.an('array').that.is.not.empty;
    });
});
