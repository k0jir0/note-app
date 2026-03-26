const sinon = require('sinon');
const { expect } = require('chai');

const { enforceServerSideApiAccessControl } = require('../src/middleware/apiAccessControl');

function buildRes() {
    return {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
    };
}

describe('API access control middleware', () => {
    it('skips non-api page requests', () => {
        const req = {
            method: 'GET',
            path: '/notes',
            originalUrl: '/notes'
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
    });

    it('allows explicit public api exceptions', () => {
        const req = {
            method: 'GET',
            path: '/__test/csrf',
            originalUrl: '/__test/csrf'
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
    });

    it('rejects protected api requests without a verified identity', () => {
        const req = {
            method: 'GET',
            path: '/api/notes',
            originalUrl: '/api/notes',
            isAuthenticated: () => false,
            user: null
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
        expect(res.json.firstCall.args[0].message).to.include('Server-side access control');
    });

    it('attaches verified identity context for protected api requests', () => {
        const req = {
            method: 'POST',
            path: '/api/notes',
            originalUrl: '/api/notes',
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com'
            }
        };
        const res = { locals: {} };
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(req.serverAccessControl.userId).to.equal('507f1f77bcf86cd799439011');
        expect(req.serverAccessControl.path).to.equal('/api/notes');
        expect(res.locals.serverAccessControl.enforcement).to.equal('server-side-api-access-control');
    });
});
