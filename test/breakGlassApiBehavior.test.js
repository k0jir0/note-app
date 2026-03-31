const sinon = require('sinon');
const { expect } = require('chai');

const breakGlassApiController = require('../src/controllers/breakGlassApiController');
const breakGlassResearchService = require('../src/services/breakGlassResearchService');

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

describe('Break-glass API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the break-glass module overview', async () => {
        const req = {
            app: {
                locals: {
                    appBaseUrl: 'http://localhost:3000',
                    breakGlass: {
                        mode: 'disabled',
                        enabled: false
                    }
                }
            },
            user: {
                _id: '507f1f77bcf86cd799439011'
            }
        };
        const res = makeRes();
        const fakeOverview = {
            module: {
                name: 'Break-Glass and Emergency Control Module'
            }
        };

        sandbox.stub(breakGlassResearchService, 'buildBreakGlassModuleOverview').returns(fakeOverview);

        await breakGlassApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });
});
