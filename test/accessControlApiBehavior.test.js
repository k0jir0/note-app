const sinon = require('sinon');
const { expect } = require('chai');

const accessControlApiController = require('../src/controllers/accessControlApiController');
const accessControlResearchService = require('../src/services/accessControlResearchService');

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

describe('Access control API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the access-control module overview', async () => {
        const req = {
            app: {
                locals: {
                    appBaseUrl: 'http://localhost:3000'
                }
            },
            user: {
                _id: '507f1f77bcf86cd799439011'
            }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Access Control Module'
            }
        };

        sandbox.stub(accessControlResearchService, 'buildAccessControlModuleOverview').returns(fakeOverview);

        await accessControlApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates scenario-evaluation input', async () => {
        const req = {
            body: {
                authenticated: 'yes',
                missionRole: []
            }
        };
        const res = makeRes();

        await accessControlApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'authenticated must be a boolean when provided',
            'missionRole must be a string when provided'
        ]);
    });

    it('returns an access-control decision for valid input', async () => {
        const req = {
            body: {
                scenarioId: 'unauthenticated-notes-api',
                authenticated: false,
                serverIdentityVerified: false
            }
        };
        const res = makeRes();
        const fakeEvaluation = {
            decision: 'deny-unauthenticated',
            httpStatus: 401
        };

        sandbox.stub(accessControlResearchService, 'evaluateAccessControlScenario').returns(fakeEvaluation);

        await accessControlApiController.evaluateScenario(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeEvaluation
        });
    });
});
