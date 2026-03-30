const sinon = require('sinon');
const { expect } = require('chai');

const xssDefenseApiController = require('../src/controllers/xssDefenseApiController');
const xssDefenseResearchService = require('../src/services/xssDefenseResearchService');

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

describe('XSS defense API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the xss-defense module overview', async () => {
        const req = {
            app: {
                locals: {
                    appBaseUrl: 'http://localhost:3000'
                }
            }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'XSS and CSP Defense Module'
            }
        };

        sandbox.stub(xssDefenseResearchService, 'buildXssDefenseModuleOverview').returns(fakeOverview);

        await xssDefenseApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenario-evaluation input', async () => {
        const req = {
            body: {
                payload: []
            }
        };
        const res = makeRes();

        await xssDefenseApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'payload must be a string when provided'
        ]);
    });

    it('returns an xss-defense decision for valid input', async () => {
        const req = {
            body: {
                scenarioId: 'script-tag-note-title',
                payload: '<script>alert(1)</script>'
            }
        };
        const res = makeRes();
        const fakeEvaluation = {
            decision: 'escape-and-restrict',
            dangerSignals: [{ id: 'script-tag' }]
        };

        sandbox.stub(xssDefenseResearchService, 'evaluateXssScenario').returns(fakeEvaluation);

        await xssDefenseApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeEvaluation
        });
    });
});
