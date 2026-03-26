const sinon = require('sinon');
const { expect } = require('chai');

const hardwareFirstMfaApiController = require('../src/controllers/hardwareFirstMfaApiController');
const hardwareFirstMfaResearchService = require('../src/services/hardwareFirstMfaResearchService');

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

describe('Hardware-first MFA API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the hardware-first MFA module overview', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            session: {},
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Hardware-First MFA Module'
            }
        };

        sandbox.stub(hardwareFirstMfaResearchService, 'buildHardwareFirstMfaModuleOverview').returns(fakeOverview);

        await hardwareFirstMfaApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates challenge input', async () => {
        const req = {
            body: {}
        };
        const res = makeRes();

        await hardwareFirstMfaApiController.issueChallenge(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal(['method is required']);
    });

    it('validates verify input', async () => {
        const req = {
            body: {
                method: '',
                challengeId: '',
                responseValue: ''
            }
        };
        const res = makeRes();

        await hardwareFirstMfaApiController.verifyChallenge(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal([
            'method is required',
            'challengeId is required',
            'responseValue is required'
        ]);
    });

    it('returns a verified hardware-first session after a successful challenge response', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            session: {},
            body: {
                method: 'hardware_token',
                challengeId: 'mfa-123',
                responseValue: 'touch'
            }
        };
        const res = makeRes();
        const fakeSessionAssurance = {
            verified: true,
            method: 'hardware_token',
            hardwareFirst: true
        };

        sandbox.stub(hardwareFirstMfaResearchService, 'verifyHardwareFirstMfaStepUp').returns(fakeSessionAssurance);

        await hardwareFirstMfaApiController.verifyChallenge(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeSessionAssurance
        });
    });

    it('returns WebAuthn registration options for a security-key enrollment request', async () => {
        const req = {
            user: { email: 'tester@example.com' },
            session: {},
            app: { locals: { appBaseUrl: 'http://localhost:3000' } }
        };
        const res = makeRes();
        const fakeRegistration = {
            challengeId: 'mfa-reg-123',
            publicKey: {
                challenge: 'abc'
            }
        };

        sandbox.stub(hardwareFirstMfaResearchService, 'startHardwareTokenRegistration').returns(fakeRegistration);

        await hardwareFirstMfaApiController.issueRegistrationOptions(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeRegistration
        });
    });

    it('validates registration verification input', async () => {
        const req = {
            body: {}
        };
        const res = makeRes();

        await hardwareFirstMfaApiController.verifyRegistration(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors).to.deep.equal(['registrationResponse is required']);
    });
});
