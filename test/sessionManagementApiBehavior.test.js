const sinon = require('sinon');
const { expect } = require('chai');

const sessionManagementApiController = require('../src/controllers/sessionManagementApiController');
const sessionManagementResearchService = require('../src/services/sessionManagementResearchService');

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

describe('Session management API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the session management module overview', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            session: {},
            app: { locals: { appBaseUrl: 'http://localhost:3000', runtimeConfig: {} } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Session Security Module'
            }
        };

        sandbox.stub(sessionManagementResearchService, 'buildSessionManagementModuleOverview').returns(fakeOverview);

        await sessionManagementApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenario-evaluation input', async () => {
        const req = {
            body: {
                idleMinutes: 'not-a-number',
                networkZone: 'space'
            }
        };
        const res = makeRes();

        await sessionManagementApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'idleMinutes must be numeric when provided',
            'networkZone must be one of public, corp, or mission'
        ]);
    });

    it('returns a lockdown evaluation for valid input', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            session: {},
            app: { locals: { runtimeConfig: {} } },
            body: {
                scenarioId: 'abandoned-field-terminal',
                idleMinutes: 8,
                elapsedHours: 1,
                networkZone: 'mission',
                concurrentLoginDetected: false
            }
        };
        const res = makeRes();
        const fakeEvaluation = {
            locked: true,
            decision: 'lock'
        };

        sandbox.stub(sessionManagementResearchService, 'evaluateSessionLockdownScenario').returns(fakeEvaluation);

        await sessionManagementApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeEvaluation
        });
    });
});
