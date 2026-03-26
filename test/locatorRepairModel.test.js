const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const {
    FEATURE_NAMES,
    clearLocatorRepairModelCache,
    loadLocatorRepairModel,
    predictLocatorRepairCandidate,
    saveLocatorRepairModel,
    trainLocatorRepairModel,
    vectorizeLocatorRepairFeatures
} = require('../src/utils/locatorRepairModel');

describe('Locator repair model utilities', () => {
    const tempModelPath = path.resolve(__dirname, '.tmp-direct-locator-repair-model.json');

    afterEach(() => {
        clearLocatorRepairModelCache();
        if (fs.existsSync(tempModelPath)) {
            fs.unlinkSync(tempModelPath);
        }
    });

    it('vectorizes locator-repair features into a stable numeric feature set', () => {
        const vector = vectorizeLocatorRepairFeatures({
            heuristicScoreNorm: 0.85,
            candidateHasDataTestId: true,
            candidateHasId: true,
            candidateHasHref: false,
            candidateHasName: true,
            candidateHasPlaceholder: false,
            candidateHasAccessibleName: true,
            candidateHasText: true,
            candidateRoleButton: true,
            originalFamilyRole: true,
            exactDataTestIdMatch: true,
            roleMatch: true,
            originalOverlap: 3,
            stepOverlap: 2,
            stableSignalCount: 3,
            upgradeTextToDataTestId: true,
            candidateTextLength: 18
        });

        expect(vector).to.have.length(FEATURE_NAMES.length);
        expect(vector[0]).to.equal(0.85);
        expect(vector[1]).to.equal(1);
    });

    it('trains a logistic model that ranks a stronger repair above a weak repair', () => {
        const positiveFeatures = {
            heuristicScoreNorm: 0.92,
            candidateHasDataTestId: true,
            candidateHasId: true,
            candidateHasHref: true,
            candidateHasName: false,
            candidateHasPlaceholder: false,
            candidateHasAccessibleName: true,
            candidateHasText: true,
            candidateRoleLink: true,
            originalFamilyText: true,
            exactDataTestIdMatch: true,
            exactHrefMatch: true,
            roleMatch: true,
            originalOverlap: 4,
            stepOverlap: 3,
            stableSignalCount: 3,
            upgradeTextToDataTestId: true,
            candidateTextLength: 19
        };
        const negativeFeatures = {
            heuristicScoreNorm: 0.2,
            candidateHasDataTestId: false,
            candidateHasId: false,
            candidateHasHref: false,
            candidateHasName: false,
            candidateHasPlaceholder: false,
            candidateHasAccessibleName: true,
            candidateHasText: true,
            candidateRoleLink: false,
            originalFamilyText: true,
            exactDataTestIdMatch: false,
            exactHrefMatch: false,
            roleMatch: false,
            originalOverlap: 0,
            stepOverlap: 1,
            stableSignalCount: 0,
            upgradeTextToDataTestId: false,
            candidateTextLength: 10
        };

        const model = trainLocatorRepairModel([
            { label: 1, features: positiveFeatures },
            { label: 1, features: { ...positiveFeatures, candidateHasHref: false, exactHrefMatch: false } },
            { label: 0, features: negativeFeatures },
            { label: 0, features: { ...negativeFeatures, candidateHasText: false, candidateHasAccessibleName: false } }
        ], {
            epochs: 500,
            learningRate: 0.35
        });
        const positivePrediction = predictLocatorRepairCandidate(positiveFeatures, model);
        const negativePrediction = predictLocatorRepairCandidate(negativeFeatures, model);

        expect(model.metrics.accuracy).to.be.at.least(0.75);
        expect(positivePrediction.score).to.be.greaterThan(negativePrediction.score);
        expect(positivePrediction.label).to.equal('high');
    });

    it('saves and loads a trained model from disk', () => {
        const model = trainLocatorRepairModel([
            {
                label: 1,
                features: {
                    heuristicScoreNorm: 0.9,
                    candidateHasDataTestId: true,
                    candidateHasId: true,
                    exactDataTestIdMatch: true,
                    originalOverlap: 4,
                    stepOverlap: 3,
                    stableSignalCount: 2
                }
            },
            {
                label: 0,
                features: {
                    heuristicScoreNorm: 0.1,
                    candidateHasDataTestId: false,
                    candidateHasId: false,
                    originalOverlap: 0,
                    stepOverlap: 0,
                    stableSignalCount: 0
                }
            }
        ]);

        const savedPath = saveLocatorRepairModel(model, { modelPath: tempModelPath });
        const loadedModel = loadLocatorRepairModel({ modelPath: tempModelPath });

        expect(savedPath).to.equal(tempModelPath);
        expect(loadedModel).to.not.equal(null);
        expect(loadedModel.featureNames).to.deep.equal(FEATURE_NAMES);
        expect(loadedModel.weights).to.deep.equal(model.weights);
    });
});
