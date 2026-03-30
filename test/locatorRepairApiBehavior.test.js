const sinon = require('sinon');
const { expect } = require('chai');

const locatorRepairApiController = require('../src/controllers/locatorRepairApiController');
const locatorRepairResearchService = require('../src/services/locatorRepairResearchService');

function makeRes() {
    const jsonSpy = sinon.spy();
    return {
        status: sinon.stub().returnsThis(),
        json(payload) {
            jsonSpy(payload);
            return payload;
        },
        _jsonSpy: jsonSpy
    };
}

describe('Locator repair API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the self-healing module overview', async () => {
        const req = {
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Self-Healing Locator Repair Module'
            },
            coverage: {
                sampleCaseCount: 5
            }
        };

        sandbox.stub(locatorRepairResearchService, 'buildLocatorRepairModuleOverview').returns(fakeOverview);

        await locatorRepairApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('returns locator repair history', async () => {
        const req = {
            query: { limit: '5' }
        };
        const res = makeRes();
        const fakeHistory = {
            summary: {
                totalEntries: 1
            },
            entries: []
        };

        sandbox.stub(locatorRepairResearchService, 'getLocatorRepairHistory').returns(fakeHistory);

        await locatorRepairApiController.getHistory(req, res);

        expect(locatorRepairResearchService.getLocatorRepairHistory.calledWithMatch({ limit: 5 })).to.equal(true);
        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeHistory
        });
    });

    it('validates locator repair request input before suggesting repairs', async () => {
        const req = {
            body: {
                locator: '',
                htmlSnippet: ''
            }
        };
        const res = makeRes();

        await locatorRepairApiController.suggestRepairs(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'locator is required',
            'htmlSnippet is required'
        ]);
    });

    it('returns ranked locator repair suggestions for valid input', async () => {
        const req = {
            body: {
                locator: 'By.linkText("Open ML Module")',
                stepGoal: 'Open the ML Module from the Research Workspace',
                htmlSnippet: '<a href="/ml/module" data-testid="research-open-ml">Open ML Workspace</a>'
            }
        };
        const res = makeRes();
        const fakeSuggestions = {
            analysis: {
                locatorFamily: 'selenium-link-text'
            },
            suggestions: [
                {
                    rank: 1,
                    primaryLocator: {
                        strategy: 'data-testid'
                    }
                }
            ]
        };

        sandbox.stub(locatorRepairResearchService, 'suggestLocatorRepairs').returns(fakeSuggestions);

        await locatorRepairApiController.suggestRepairs(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeSuggestions
        });
    });

    it('validates feedback input before recording repair feedback', async () => {
        const req = {
            body: {
                locator: '',
                htmlSnippet: '',
                feedbackLabel: ''
            }
        };
        const res = makeRes();

        await locatorRepairApiController.recordFeedback(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'locator is required',
            'htmlSnippet is required',
            'feedbackLabel is required'
        ]);
    });

    it('records locator repair feedback for valid input', async () => {
        const req = {
            body: {
                locator: 'By.linkText("Open ML Module")',
                stepGoal: 'Open the ML Module from the Research Workspace',
                htmlSnippet: '<a href="/ml/module" data-testid="research-open-ml">Open ML Workspace</a>',
                selectedFingerprint: 'candidate-1',
                feedbackLabel: 'accepted',
                framework: 'playwright'
            }
        };
        const res = makeRes();
        const fakeFeedback = {
            history: {
                summary: {
                    totalEntries: 1
                }
            }
        };

        sandbox.stub(locatorRepairResearchService, 'recordLocatorRepairFeedback').returns(fakeFeedback);

        await locatorRepairApiController.recordFeedback(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].message).to.equal('Self-healing feedback recorded successfully');
        expect(res._jsonSpy.firstCall.args[0].data).to.deep.equal(fakeFeedback);
    });

    it('validates training mode before training the locator repair model', async () => {
        const req = {
            body: { mode: 'invalid' }
        };
        const res = makeRes();

        await locatorRepairApiController.trainModel(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors[0]).to.include('mode must be either bootstrap or hybrid');
    });

    it('trains the locator repair model and returns the training summary', async () => {
        const req = {
            body: { mode: 'bootstrap' }
        };
        const res = makeRes();
        const fakeResult = {
            mode: 'bootstrap',
            bootstrapExamples: 12,
            model: {
                available: true,
                trainingSamples: 12
            }
        };

        sandbox.stub(locatorRepairResearchService, 'trainAndPersistLocatorRepairModel').returns(fakeResult);

        await locatorRepairApiController.trainModel(req, res);

        expect(locatorRepairResearchService.trainAndPersistLocatorRepairModel.calledWithMatch({
            mode: 'bootstrap'
        })).to.equal(true);
        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].message).to.equal('Bootstrap self-healing model trained successfully');
        expect(res._jsonSpy.firstCall.args[0].data).to.deep.equal(fakeResult);
    });
});
