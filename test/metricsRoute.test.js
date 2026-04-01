const { expect } = require('chai');
const sinon = require('sinon');

const metrics = require('../src/routes/metrics');

describe('metrics route protection', () => {
    afterEach(() => {
        delete process.env.METRICS_AUTH_TOKEN;
        sinon.restore();
    });

    it('rejects unauthenticated metrics requests when no metrics token is configured', () => {
        const req = {
            headers: {}
        };
        const res = {
            status: sinon.stub().returnsThis(),
            type: sinon.stub().returnsThis(),
            send: sinon.stub()
        };
        const next = sinon.stub();

        metrics.authorizeMetricsRequest(req, res, next);

        expect(res.status.calledWith(401)).to.equal(true);
        expect(res.type.calledWith('text/plain')).to.equal(true);
        expect(res.send.calledWith('Unauthorized')).to.equal(true);
        expect(next.called).to.equal(false);
    });

    it('allows metrics requests with a valid bearer token', () => {
        process.env.METRICS_AUTH_TOKEN = 'super-secret-token';

        const req = {
            headers: {
                authorization: 'Bearer super-secret-token'
            }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            type: sinon.stub().returnsThis(),
            send: sinon.stub()
        };
        const next = sinon.stub();

        metrics.authorizeMetricsRequest(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
    });
});
