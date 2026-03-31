const sinon = require('sinon');
const { expect } = require('chai');
const expressRequest = require('express/lib/request');

const { enforceServerSideApiAccessControl } = require('../src/middleware/apiAccessControl');
const { sanitizeRequestSurfaces } = require('../src/services/apiAccessControlService');

function buildRes() {
    return {
        locals: {},
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
    };
}

describe('API access control middleware', () => {
    it('sanitizes getter-backed Express query objects before downstream controllers read them', () => {
        const req = Object.create(expressRequest);
        req.app = {
            get(setting) {
                if (setting === 'query parser fn') {
                    return () => ({
                        limit: ' 10 ',
                        constructor: {
                            polluted: true
                        }
                    });
                }

                if (setting === 'trust proxy fn') {
                    return () => false;
                }

                return undefined;
            }
        };
        req.url = '/api/security/alerts?limit=%2010%20';
        req.body = {
            title: '  Mission note\u0000  '
        };
        req.params = {
            id: ' alert-1 '
        };

        const sanitized = sanitizeRequestSurfaces(req);

        expect(req.body.title).to.equal('Mission note');
        expect(req.query.limit).to.equal('10');
        expect(Object.prototype.hasOwnProperty.call(req.query, 'constructor')).to.equal(false);
        expect(req.params.id).to.equal('alert-1');
        expect(Object.prototype.hasOwnProperty.call(req, 'query')).to.equal(true);
        expect(sanitized.query).to.equal(req.query);
    });

    it('skips non-api page requests', () => {
        const req = {
            method: 'GET',
            path: '/notes',
            originalUrl: '/notes',
            body: {
                title: '  Preserve page input  '
            }
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
        expect(req.body.title).to.equal('  Preserve page input  ');
        expect(req.zeroTrustInput).to.equal(undefined);
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

    it('rejects protected api requests for disabled authenticated accounts', () => {
        const req = {
            method: 'GET',
            path: '/api/notes',
            originalUrl: '/api/notes',
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'disabled@example.com',
                accountState: {
                    status: 'disabled'
                }
            }
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
        expect(res.json.firstCall.args[0].data.policyId).to.equal('break-glass-role-required');
        expect(req.body.mode).to.equal('offline');
    });

    it('rejects break-glass runtime mutations when recent hardware-first MFA is missing', () => {
        const req = {
            method: 'POST',
            path: '/api/runtime/break-glass',
            originalUrl: '/api/runtime/break-glass',
            body: {
                mode: ' read_only '
            },
            query: {},
            params: {},
            session: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'admin@example.com',
                accessProfile: {
                    missionRole: 'admin'
                }
            }
        };
        const res = buildRes();
        const next = sinon.spy();

        enforceServerSideApiAccessControl(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(403)).to.equal(true);
        expect(res.json.firstCall.args[0].data.requirement).to.equal('break_glass_operator_with_recent_hardware_step_up');
    });

    it('rejects privileged runtime diagnostics for non-admin users', () => {
        const req = {
            method: 'GET',
            path: '/__runtime-config',
            originalUrl: '/__runtime-config',
            body: {},
            query: {},
            params: {},
            isAuthenticated: () => true,
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'analyst@example.com',
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
        expect(res.json.firstCall.args[0].data.policyId).to.equal('privileged-runtime-read');
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
