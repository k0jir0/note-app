const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const {
    FEATURE_NAMES,
    clearAlertTriageModelCache,
    loadAlertTriageModel,
    predictAlertTriageFromFeatures,
    saveAlertTriageModel,
    trainAlertTriageModel,
    vectorizeAlertFeatures
} = require('../src/utils/alertTriageModel');

describe('Alert triage model utilities', () => {
    const tempModelPath = path.resolve(__dirname, '.tmp-alert-triage-model.json');

    afterEach(() => {
        clearAlertTriageModelCache();
        if (fs.existsSync(tempModelPath)) {
            fs.unlinkSync(tempModelPath);
        }
    });

    it('vectorizes alert features into a stable numeric feature set', () => {
        const vector = vectorizeAlertFeatures({
            type: 'failed_login_burst',
            severity: 'medium',
            count: 9,
            threshold: 5,
            ratio: 0.25,
            sampleSize: 3,
            toolCount: 0,
            sourceIpCount: 2,
            summaryLength: 120,
            hasIpIndicator: true,
            hasFingerprint: false
        });

        expect(vector).to.have.length(FEATURE_NAMES.length);
        expect(vector[0]).to.be.closeTo(0.36, 0.001);
        expect(vector[FEATURE_NAMES.indexOf('severity_medium')]).to.equal(1);
        expect(vector[FEATURE_NAMES.indexOf('type_failed_login_burst')]).to.equal(1);
    });

    it('trains a logistic model that ranks higher-risk examples above low-risk ones', () => {
        const examples = [
            {
                label: 1,
                features: {
                    type: 'injection_attempt',
                    severity: 'high',
                    count: 12,
                    threshold: 4,
                    ratio: 0.42,
                    sampleSize: 3,
                    toolCount: 1,
                    sourceIpCount: 2,
                    summaryLength: 140,
                    hasIpIndicator: true,
                    hasFingerprint: true
                }
            },
            {
                label: 1,
                features: {
                    type: 'directory_enumeration',
                    severity: 'high',
                    count: 18,
                    threshold: 5,
                    ratio: 0.67,
                    sampleSize: 4,
                    toolCount: 2,
                    sourceIpCount: 4,
                    summaryLength: 170,
                    hasIpIndicator: true,
                    hasFingerprint: true
                }
            },
            {
                label: 0,
                features: {
                    type: 'scanner_tool_detected',
                    severity: 'low',
                    count: 1,
                    threshold: 5,
                    ratio: 0.02,
                    sampleSize: 1,
                    toolCount: 0,
                    sourceIpCount: 1,
                    summaryLength: 50,
                    hasIpIndicator: false,
                    hasFingerprint: false
                }
            },
            {
                label: 0,
                features: {
                    type: 'high_error_rate',
                    severity: 'low',
                    count: 2,
                    threshold: 8,
                    ratio: 0.08,
                    sampleSize: 1,
                    toolCount: 0,
                    sourceIpCount: 1,
                    summaryLength: 65,
                    hasIpIndicator: false,
                    hasFingerprint: false
                }
            }
        ];

        const model = trainAlertTriageModel(examples, {
            epochs: 500,
            learningRate: 0.4
        });
        const highRisk = predictAlertTriageFromFeatures(examples[0].features, model);
        const lowRisk = predictAlertTriageFromFeatures(examples[2].features, model);

        expect(model.metrics.accuracy).to.be.at.least(0.75);
        expect(highRisk.score).to.be.greaterThan(lowRisk.score);
        expect(highRisk.label).to.equal('high');
    });

    it('saves and loads a trained model from disk', () => {
        const model = trainAlertTriageModel([
            {
                label: 1,
                features: {
                    type: 'injection_attempt',
                    severity: 'high',
                    count: 10,
                    threshold: 5,
                    ratio: 0.4,
                    sampleSize: 3,
                    toolCount: 1,
                    sourceIpCount: 2,
                    summaryLength: 130,
                    hasIpIndicator: true,
                    hasFingerprint: true
                }
            },
            {
                label: 0,
                features: {
                    type: 'scanner_tool_detected',
                    severity: 'low',
                    count: 1,
                    threshold: 5,
                    ratio: 0.03,
                    sampleSize: 1,
                    toolCount: 0,
                    sourceIpCount: 1,
                    summaryLength: 60,
                    hasIpIndicator: false,
                    hasFingerprint: false
                }
            }
        ]);

        const savedPath = saveAlertTriageModel(model, { modelPath: tempModelPath });
        const loadedModel = loadAlertTriageModel({ modelPath: tempModelPath });

        expect(savedPath).to.equal(tempModelPath);
        expect(loadedModel).to.not.equal(null);
        expect(loadedModel.featureNames).to.deep.equal(FEATURE_NAMES);
        expect(loadedModel.weights).to.deep.equal(model.weights);
    });
});
