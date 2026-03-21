const sinon = require('sinon');
const { expect } = require('chai');

const SecurityAlert = require('../src/models/SecurityAlert');
const ScanResult = require('../src/models/ScanResult');
const securityApiController = require('../src/controllers/securityApiController');

function makeRes() {
    const jsonSpy = sinon.spy();
    return {
        status: sinon.stub().returnsThis(),
        json: function (payload) {
            jsonSpy(payload);
            return payload;
        },
        _jsonSpy: jsonSpy
    };
}

describe('Security API controller behavior', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('getCorrelations returns count, totalCount, data and overview', async () => {
        const fakeUser = { _id: 'user1' };
        const req = { user: fakeUser, query: {} };
        const res = makeRes();

        const scans = [
            { _id: 's1', target: '10.0.0.1', tool: 'nmap', importedAt: new Date() }
        ];

        const alerts = [
            { _id: 'a1', target: '10.0.0.1', details: { ip: '10.0.0.1' }, type: 'scanner_tool_detected', severity: 'low', detectedAt: new Date() }
        ];

        // stub chainable query: find(...).select(...).sort(...).lean().limit(...) => resolves to array
        sandbox.stub(SecurityAlert, 'find').returns({
            select: () => ({
                sort: () => ({
                    lean: () => ({
                        limit: async () => alerts
                    })
                })
            })
        });
        sandbox.stub(ScanResult, 'find').returns({
            select: () => ({
                sort: () => ({
                    lean: () => ({
                        limit: async () => scans
                    })
                })
            })
        });

        await securityApiController.getCorrelations(req, res);

        // res.json is invoked via the helper - inspect spy
        const calledPayload = res._jsonSpy.getCall(0).args[0];
        expect(calledPayload).to.have.property('count');
        expect(calledPayload).to.have.property('totalCount');
        expect(calledPayload).to.have.property('data');
        expect(calledPayload).to.have.property('overview');
        expect(calledPayload.overview).to.have.property('total').that.is.a('number');
    });

    it('getSampleCorrelations appends demo records and returns meta with created counts', async () => {
        const fakeUser = { _id: 'user2' };
        const req = { user: fakeUser, query: {}, app: { locals: {} } };
        const res = makeRes();

        // Simulate insertMany returning created docs
        const fakeInsertedScans = [
            { _id: 's_new1', target: '10.10.10.50', tool: 'nmap', importedAt: new Date() },
            { _id: 's_new2', target: '10.10.10.60', tool: 'nmap', importedAt: new Date() }
        ];
        const fakeInsertedAlerts = [
            { _id: 'a_new1', target: '10.10.10.50', details: { ip: '10.10.10.50' }, type: 'scanner_tool_detected', severity: 'low', detectedAt: new Date() },
            { _id: 'a_new2', target: '10.10.10.60', details: { ip: '10.10.10.60' }, type: 'scanner_tool_detected', severity: 'low', detectedAt: new Date() },
            { _id: 'a_new3', target: '10.10.10.70', details: { ip: '10.10.10.70' }, type: 'scanner_tool_detected', severity: 'low', detectedAt: new Date() }
        ];

        const insertScansStub = sandbox.stub(ScanResult, 'insertMany').resolves(fakeInsertedScans);
        const insertAlertsStub = sandbox.stub(SecurityAlert, 'insertMany').resolves(fakeInsertedAlerts);

        // After insertion, find should return previous + inserted; emulate by resolving a larger array
        const existingScans = [{ _id: 's_old1', target: '10.0.0.50', tool: 'nmap', importedAt: new Date() }];
        const existingAlerts = [{ _id: 'a_old1', target: '10.0.0.50', details: { ip: '10.0.0.50' }, type: 'scanner_tool_detected', severity: 'low', detectedAt: new Date() }];

        // First call to find returns combined set
        sandbox.stub(ScanResult, 'find').returns({
            select: () => ({
                sort: () => ({
                    lean: () => ({
                        limit: async () => [...existingScans, ...fakeInsertedScans]
                    })
                })
            })
        });
        sandbox.stub(SecurityAlert, 'find').returns({
            select: () => ({
                sort: () => ({
                    lean: () => ({
                        limit: async () => [...existingAlerts, ...fakeInsertedAlerts]
                    })
                })
            })
        });

        await securityApiController.getSampleCorrelations(req, res);

        const calledPayload = res._jsonSpy.getCall(0).args[0];
        expect(calledPayload).to.have.property('meta');
        expect(calledPayload.meta).to.have.property('createdScans', fakeInsertedScans.length);
        expect(calledPayload.meta).to.have.property('createdAlerts', fakeInsertedAlerts.length);
        expect(insertScansStub.calledOnce).to.equal(true);
        expect(insertAlertsStub.calledOnce).to.equal(true);
    });

    it('streamEvents returns a lightweight probe response when requested', async () => {
        const req = {
            app: { locals: { realtimeEnabled: true } },
            query: { probe: '1' }
        };
        const res = makeRes();

        await securityApiController.streamEvents(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        expect(res._jsonSpy.calledOnce).to.equal(true);
        expect(res._jsonSpy.firstCall.args[0]).to.deep.equal({
            success: true,
            enabled: true
        });
    });
});
