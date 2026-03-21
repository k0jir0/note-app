const sinon = require('sinon');
const { expect } = require('chai');

const mlApiController = require('../src/controllers/mlApiController');
const trainingService = require('../src/services/alertTriageTrainingService');

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

describe('ML API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns the ML module overview', async () => {
        const req = {
            user: { _id: 'user-overview' }
        };
        const res = makeRes();
        const fakeOverview = {
            model: { available: false, path: 'C:\\temp\\model.json' },
            training: { currentUserTrainableCount: 3, projectTrainableCount: 12 },
            alerts: { totalCount: 8, recentAlerts: [] }
        };

        sandbox.stub(trainingService, 'buildAlertTriageModuleOverview').resolves(fakeOverview);

        await mlApiController.getOverview(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            data: fakeOverview
        });
    });

    it('validates training mode before training the model', async () => {
        const req = {
            user: { _id: 'user-overview' },
            body: { mode: 'invalid' }
        };
        const res = makeRes();

        await mlApiController.trainModel(req, res);

        expect(res.status.calledWith(400)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].errors[0]).to.include('mode must be either bootstrap or mixed');
    });

    it('trains the ML model and returns the training summary', async () => {
        const req = {
            user: { _id: 'user-overview' },
            body: { mode: 'bootstrap', syntheticCount: '1000' }
        };
        const res = makeRes();
        const fakeResult = {
            mode: 'bootstrap',
            rescoredAlerts: 18,
            model: {
                available: true,
                trainingSamples: 1000
            }
        };

        sandbox.stub(trainingService, 'trainAndPersistAlertTriageModel').resolves(fakeResult);

        await mlApiController.trainModel(req, res);

        expect(trainingService.trainAndPersistAlertTriageModel.calledWithMatch({
            mode: 'bootstrap',
            syntheticCount: 1000,
            minRealCount: 150
        })).to.equal(true);
        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0].message).to.equal('Bootstrap ML model trained successfully');
        expect(res._jsonSpy.firstCall.args[0].data).to.deep.equal(fakeResult);
    });
});
