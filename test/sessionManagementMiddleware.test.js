const sinon = require('sinon');
const { expect } = require('chai');

const { enforceStrictSessionManagement } = require('../src/middleware/sessionManagement');

function buildRes() {
    return {
        locals: {},
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis(),
        redirect: sinon.stub().returnsThis(),
        clearCookie: sinon.stub().returnsThis()
    };
}

describe('Session management middleware', () => {
    it('initializes and allows a valid authenticated session', async () => {
        const req = {
            path: '/notes',
            session: {},
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: {
                    networkZones: ['corp']
                }
            },
            app: {
                locals: {
                    runtimeConfig: {}
                }
            },
            isAuthenticated: () => true,
            logout: (callback) => callback(null)
        };
        const res = buildRes();
        const next = sinon.spy();

        await enforceStrictSessionManagement(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(req.session.sessionManagement.sessionId).to.match(/^sess-/);
        expect(res.locals.sessionManagement.valid).to.equal(true);
        expect(res.status.called).to.equal(false);
    });

    it('returns 401 for an idle-expired API session', async () => {
        const now = Date.now();
        const req = {
            path: '/api/notes',
            session: {
                sessionManagement: {
                    sessionId: 'sess-old',
                    userId: '507f1f77bcf86cd799439011',
                    networkZone: 'corp',
                    issuedAt: new Date(now - (40 * 60 * 1000)).toISOString(),
                    lastActivityAt: new Date(now - (20 * 60 * 1000)).toISOString(),
                    idleTimeoutMs: 15 * 60 * 1000,
                    absoluteTimeoutMs: 8 * 60 * 60 * 1000,
                    lastLockReason: '',
                    lastLockAt: ''
                },
                destroy: (callback) => callback(null)
            },
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: {
                    networkZones: ['corp']
                },
                sessionControl: {
                    activeSessionId: 'sess-old'
                }
            },
            app: {
                locals: {
                    runtimeConfig: {}
                }
            },
            isAuthenticated: () => true,
            logout: (callback) => callback(null),
            get: (header) => (header === 'accept' ? 'application/json' : '')
        };
        const res = buildRes();
        const next = sinon.spy();

        await enforceStrictSessionManagement(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
        expect(res.json.firstCall.args[0].data.reason).to.equal('idle_timeout');
    });

    it('redirects page requests when a newer login supersedes the session', async () => {
        const now = Date.now();
        const req = {
            path: '/notes',
            session: {
                sessionManagement: {
                    sessionId: 'sess-old',
                    userId: '507f1f77bcf86cd799439011',
                    networkZone: 'corp',
                    issuedAt: new Date(now - (10 * 60 * 1000)).toISOString(),
                    lastActivityAt: new Date(now - (1 * 60 * 1000)).toISOString(),
                    idleTimeoutMs: 15 * 60 * 1000,
                    absoluteTimeoutMs: 8 * 60 * 60 * 1000,
                    lastLockReason: '',
                    lastLockAt: ''
                },
                destroy: (callback) => callback(null)
            },
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: {
                    networkZones: ['corp']
                },
                sessionControl: {
                    activeSessionId: 'sess-new'
                }
            },
            app: {
                locals: {
                    runtimeConfig: {}
                }
            },
            isAuthenticated: () => true,
            logout: (callback) => callback(null),
            get: () => ''
        };
        const res = buildRes();
        const next = sinon.spy();

        await enforceStrictSessionManagement(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.redirect.calledWith('/auth/login?reason=concurrent_login')).to.equal(true);
    });
});
