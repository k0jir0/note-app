const sinon = require('sinon');
const { expect } = require('chai');

const locatorRepairResearchService = require('../src/services/locatorRepairResearchService');
const { findWithSelfHealing } = require('../src/lib/seleniumSelfHealing');

describe('Selenium self-healing helper', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('falls back to a healed Selenium locator and records the outcome', async () => {
        const healedElement = {};
        const driver = {
            findElement: sandbox.stub().returns({
                getAttribute: sandbox.stub().resolves('<a data-testid="research-open-ml">Open ML Workspace</a>')
            }),
            wait: sandbox.stub().resolves(healedElement),
            getCurrentUrl: sandbox.stub().resolves('http://localhost:3000/research')
        };

        sandbox.stub(locatorRepairResearchService, 'suggestLocatorRepairs').returns({
            suggestions: [
                {
                    candidate: {
                        fingerprint: 'candidate-1',
                        dataTestId: 'research-open-ml'
                    },
                    primaryLocator: {
                        strategy: 'data-testid'
                    },
                    healDecision: {
                        autoApplyEligible: true,
                        canVerify: true,
                        reason: 'Strong match.'
                    }
                }
            ]
        });
        const recordStub = sandbox.stub(locatorRepairResearchService, 'recordLocatorRepairFeedback').returns({});
        const find = sandbox.stub().rejects(new Error('Original element not found'));
        const verify = sandbox.stub().resolves(true);

        const result = await findWithSelfHealing(driver, {
            find,
            locator: 'By.linkText("Open ML Module")',
            stepGoal: 'Open the ML Module from the Research Workspace',
            verify
        });

        expect(result).to.equal(healedElement);
        expect(recordStub.calledWithMatch({
            feedbackLabel: 'healed',
            framework: 'selenium'
        })).to.equal(true);
    });
});
