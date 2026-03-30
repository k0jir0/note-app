const sinon = require('sinon');
const { expect } = require('chai');

const seleniumApiController = require('../src/controllers/seleniumApiController');
const seleniumResearchService = require('../src/services/seleniumResearchService');

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

describe('Selenium API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the Selenium module overview', async () => {
        const req = {
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Selenium Testing Module'
            },
            coverage: {
                scenarioCount: 5,
                authenticatedScenarioCount: 5
            }
        };

        sandbox.stub(seleniumResearchService, 'buildSeleniumModuleOverview').returns(fakeOverview);

        await seleniumApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenarioId before returning a Selenium script', async () => {
        const req = {
            query: { scenarioId: 'bad-scenario' },
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();

        await seleniumApiController.getScript(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors[0]).to.include('scenarioId must match a registered Selenium scenario');
    });

    it('returns a generated Selenium script for a valid scenario', async () => {
        const req = {
            query: { scenarioId: 'workspace-navigation' },
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeScript = {
            scenarioId: 'workspace-navigation',
            fileName: 'selenium-workspace-navigation.js',
            content: 'console.log("ok");'
        };

        sandbox.stub(seleniumResearchService, 'buildSeleniumScript').returns(fakeScript);

        await seleniumApiController.getScript(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeScript
        });
    });
});
