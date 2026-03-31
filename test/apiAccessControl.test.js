const sinon = require('sinon');
const { expect } = require('chai');

const { enforceServerSideApiAccessControl } = require('../src/middleware/apiAccessControl');

function buildRes() {
    return {
        locals: {},
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
            body: {
                title: '  Mission note\u0000  ',
                constructor: {
                    polluted: true
                }
            },
            query: {
                page: ' 2 '
            },
            params: {
                id: ' note-1 '
            },
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com'
            }
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(req.body.title).to.equal('Mission note');
        expect(Object.prototype.hasOwnProperty.call(req.body, 'constructor')).to.equal(false);
        expect(req.query.page).to.equal('2');
        expect(req.params.id).to.equal('note-1');
        expect(req.zeroTrustInput.body.title).to.equal('Mission note');
        expect(req.serverAccessControl.userId).to.equal('507f1f77bcf86cd799439011');
        expect(req.serverAccessControl.path).to.equal('/api/notes');
        expect(req.serverAccessControl.authorization.policyId).to.equal('authenticated-api-access');
        expect(res.locals.serverAccessControl.enforcement).to.equal('server-side-api-access-control');
    });

    it('rejects break-glass runtime control for authenticated users without the required role', () => {
        const req = {
            method: 'POST',
            path: '/api/runtime/break-glass',
            originalUrl: '/api/runtime/break-glass',
            body: {
                mode: ' offline '
            },
            query: {},
            params: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: {
                    missionRole: 'analyst'
                }
            }
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(403)).to.equal(true);
        expect(res.json.firstCall.args[0].data.policyId).to.equal('break-glass-control');
        expect(req.body.mode).to.equal('offline');
    });

    it('fails secure when access-control evaluation throws', () => {
        const req = {
            method: 'GET',
            path: '/api/notes',
            originalUrl: '/api/notes',
            body: {},
            query: {},
            params: {},
            isAuthenticated() {
                throw new Error('session store unavailable');
            },
            user: {
                _id: '507f1f77bcf86cd799439011'
            }
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
        expect(res.json.firstCall.args[0]).to.deep.equal({
            success: false,
            message: 'Unauthorized',
            errors: ['The request could not be authenticated safely and has been denied.']
        });
    });
});
