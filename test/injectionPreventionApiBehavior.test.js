const sinon = require('sinon');
const { expect } = require('chai');

const injectionPreventionApiController = require('../src/controllers/injectionPreventionApiController');
const injectionPreventionResearchService = require('../src/services/injectionPreventionResearchService');

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

describe('Injection prevention API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the injection-prevention module overview', async () => {
        const req = {
            app: {
                locals: {
                    appBaseUrl: 'http://localhost:3000',
                    mongooseLib: {}
                }
            }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Query Injection Prevention Module'
            }
        };

        sandbox.stub(injectionPreventionResearchService, 'buildInjectionPreventionModuleOverview').returns(fakeOverview);

        await injectionPreventionApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenario-evaluation input', async () => {
        const req = {
            body: {
                surface: 'headers',
                payload: []
            }
        };
        const res = makeRes();

        await injectionPreventionApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'surface must be one of body, query, or params',
            'payload must be an object when provided'
        ]);
    });

    it('returns an injection-prevention decision for valid input', async () => {
        const req = {
            body: {
                scenarioId: 'nosql-operator-body',
                surface: 'body',
                payload: {
                    probe: {
                        $ne: null
                    }
                }
            }
        };
        const res = makeRes();
        const fakeEvaluation = {
            decision: 'reject',
            blocked: true
        };

        sandbox.stub(injectionPreventionResearchService, 'evaluateInjectionScenario').returns(fakeEvaluation);

        await injectionPreventionApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeEvaluation
        });
    });
});
