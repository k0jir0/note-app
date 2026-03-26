const sinon = require('sinon');
const { expect } = require('chai');

const missionAssuranceApiController = require('../src/controllers/missionAssuranceApiController');
const missionAssuranceResearchService = require('../src/services/missionAssuranceResearchService');

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

describe('Mission assurance API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the mission assurance module overview', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Mission Assurance Module'
            }
        };

        sandbox.stub(missionAssuranceResearchService, 'buildMissionAssuranceModuleOverview').returns(fakeOverview);

        await missionAssuranceApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates decision-evaluation input', async () => {
        const req = {
            body: {
                actionId: '',
                resourceId: ''
            }
        };
        const res = makeRes();

        await missionAssuranceApiController.evaluateDecision(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'actionId is required',
            'resourceId is required'
        ]);
    });

    it('returns a policy decision for valid input', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            body: {
                personaId: 'current-user',
                actionId: 'view_security_alerts',
                resourceId: 'security-alert-feed',
                context: {
                    networkZone: 'corp'
                }
            }
        };
        const res = makeRes();
        const fakeDecision = {
            decision: 'allow',
            allowed: true
        };

        sandbox.stub(missionAssuranceResearchService, 'evaluateMissionAssuranceScenario').returns(fakeDecision);

        await missionAssuranceApiController.evaluateDecision(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeDecision
        });
    });
});
