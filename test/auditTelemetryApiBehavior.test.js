const sinon = require('sinon');
const { expect } = require('chai');

const auditTelemetryApiController = require('../src/controllers/auditTelemetryApiController');
const persistentAuditService = require('../src/services/persistentAuditService');

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

describe('audit telemetry API controller behavior', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns paginated audit events for the authenticated user', async () => {
        const req = {
            user: { _id: '507f1f77bcf86cd799439011' },
            query: { page: '2', limit: '5', level: 'audit', category: 'http-request' }
        };
        const res = makeRes();

        sinon.stub(persistentAuditService, 'listAuditEventsForUser').resolves({
            events: [{ _id: 'evt-1', message: 'HTTP request completed' }],
            totalCount: 9,
            page: 2,
            limit: 5
        });

        await auditTelemetryApiController.getEvents(req, res);

        expect(res.status.calledWith(200)).to.equal(true);
        const payload = res._jsonSpy.firstCall.args[0];
        expect(payload.success).to.equal(true);
        expect(payload.count).to.equal(1);
        expect(payload.data).to.have.length(1);
        expect(payload.pagination.currentPage).to.equal(2);
        expect(payload.pagination.totalCount).to.equal(9);
        expect(payload.filters.level).to.equal('audit');
        expect(payload.filters.category).to.equal('http-request');
    });
});
