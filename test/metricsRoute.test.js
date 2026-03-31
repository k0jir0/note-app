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

    it('allows privileged admin sessions to read metrics without a token', () => {
        const req = {
            headers: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                accessProfile: {
                    missionRole: 'admin'
                },
                accountState: {
                    status: 'active'
                }
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

    it('rejects non-privileged authenticated sessions when no metrics token is configured', () => {
        const req = {
            headers: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                accessProfile: {
                    missionRole: 'analyst'
                },
                accountState: {
                    status: 'active'
                }
            }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            type: sinon.stub().returnsThis(),
            send: sinon.stub()
        };
        const next = sinon.stub();

        metrics.authorizeMetricsRequest(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
    });

    it('rejects disabled authenticated sessions when no metrics token is configured', () => {
        const req = {
            headers: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                accessProfile: {
                    missionRole: 'admin'
                },
                accountState: {
                    status: 'disabled'
                }
            }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            type: sinon.stub().returnsThis(),
            send: sinon.stub()
        };
        const next = sinon.stub();

        metrics.authorizeMetricsRequest(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
    });
});
