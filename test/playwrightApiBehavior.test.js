const sinon = require('sinon');
const { expect } = require('chai');

const playwrightApiController = require('../src/controllers/playwrightApiController');
const playwrightResearchService = require('../src/services/playwrightResearchService');

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

describe('Playwright API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the Playwright module overview', async () => {
        const req = {
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Playwright Testing Module'
            },
            coverage: {
                scenarioCount: 6,
                authenticatedScenarioCount: 6
            }
        };

        sandbox.stub(playwrightResearchService, 'buildPlaywrightModuleOverview').returns(fakeOverview);

        await playwrightApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenarioId before returning a Playwright spec', async () => {
        const req = {
            query: { scenarioId: 'bad-scenario' },
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();

        await playwrightApiController.getScript(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors[0]).to.include('scenarioId must match a registered Playwright scenario');
    });

    it('returns a generated Playwright spec for a valid scenario', async () => {
        const req = {
            query: { scenarioId: 'workspace-navigation' },
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeScript = {
            scenarioId: 'workspace-navigation',
            fileName: 'playwright-workspace-navigation.spec.js',
            content: 'console.log("ok");'
        };

        sandbox.stub(playwrightResearchService, 'buildPlaywrightScript').returns(fakeScript);

        await playwrightApiController.getScript(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeScript
        });
    });
});
