const sinon = require('sinon');
const { expect } = require('chai');

const locatorRepairResearchService = require('../src/services/locatorRepairResearchService');
const { resolveWithSelfHealing } = require('../src/lib/playwrightSelfHealing');

describe('Playwright self-healing helper', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('falls back to a healed Playwright locator and records the outcome', async () => {
        const originalLocator = {
            waitFor: sandbox.stub().rejects(new Error('Original locator not found'))
        };
        const healedLocator = {
            waitFor: sandbox.stub().resolves()
        };
        const page = {
            url: sandbox.stub().returns('http://localhost:3000/research'),
            locator: sandbox.stub(),
            getByTestId: sandbox.stub().returns(healedLocator),
            content: sandbox.stub().resolves('<body></body>')
        };

        page.locator.withArgs('body').returns({
            evaluate: sandbox.stub().resolves('<a data-testid="research-open-ml">Open ML Workspace</a>')
        });

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
        const locate = sandbox.stub().returns(originalLocator);
        const verify = sandbox.stub().resolves(true);

        const result = await resolveWithSelfHealing(page, {
            locate,
            locator: 'By.linkText("Open ML Module")',
            stepGoal: 'Open the ML Module from the Research Workspace',
            verify
        });

        expect(result).to.equal(healedLocator);
        expect(recordStub.calledWithMatch({
            feedbackLabel: 'healed',
            framework: 'playwright'
        })).to.equal(true);
    });
});
