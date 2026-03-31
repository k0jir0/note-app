const { expect } = require('chai');
const sinon = require('sinon');
const passport = require('passport');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const authRoutes = require('../src/routes/authRoutes');
const User = require('../src/models/User');
const { authRateLimiter } = require('../src/middleware/rateLimit');

const getRouteLayer = (method, path) => {
    const layer = authRoutes.stack.find(
        (entry) =>
            entry.route &&
            entry.route.path === path &&
            entry.route.methods[method]
    );

    return layer || null;
};

const getHandler = (method, path, stackIndex = 0) => {
    const layer = getRouteLayer(method, path);
    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    locals: { csrfToken: 'test-csrf-token' },
    render: sinon.stub(),
    redirect: sinon.stub(),
    status: sinon.stub().returnsThis(),
    json: sinon.stub(),
    clearCookie: sinon.stub()
});

describe('Auth Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('GET /login', () => {
        it('should render the login page', () => {
            const handler = getHandler('get', '/login');

            const req = {};
            const res = buildRes();

            handler(req, res);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: null,
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });
    });

    describe('Google auth routes', () => {
        it('redirects Google auth to the configured canonical base URL before starting OAuth', () => {
            const handler = getHandler('get', '/login/federated/google');
            const originalAppBaseUrl = process.env.APP_BASE_URL;
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

            try {
                process.env.APP_BASE_URL = 'http://localhost:3000';
                process.env.GOOGLE_CLIENT_ID = 'client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

                const authenticateStub = sinon.stub(passport, 'authenticate');
                const req = {
                    protocol: 'http',
                    originalUrl: '/auth/login/federated/google',
                    get: sinon.stub().withArgs('host').returns('127.0.0.1:3000')
                };
                const res = buildRes();
                const next = sinon.stub();

                handler(req, res, next);

                expect(res.redirect.calledWith('http://localhost:3000/auth/login/federated/google')).to.be.true;
                expect(authenticateStub.called).to.be.false;
            } finally {
                if (originalAppBaseUrl === undefined) {
                    delete process.env.APP_BASE_URL;
                } else {
                    process.env.APP_BASE_URL = originalAppBaseUrl;
                }

                if (originalClientId === undefined) {
                    delete process.env.GOOGLE_CLIENT_ID;
                } else {
                    process.env.GOOGLE_CLIENT_ID = originalClientId;
                }

                if (originalClientSecret === undefined) {
                    delete process.env.GOOGLE_CLIENT_SECRET;
                } else {
                    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
                }
            }
        });

        it('renders a helpful login error when Google token exchange is unauthorized', () => {
            const handler = getHandler('get', '/oauth2/redirect/google');
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

            try {
                process.env.GOOGLE_CLIENT_ID = 'client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

                sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                    expect(strategy).to.equal('google');
                    return () => callback({ name: 'TokenError', message: 'Unauthorized' });
                });

                const req = {};
                const res = buildRes();
                const next = sinon.stub();

                handler(req, res, next);

                expect(res.status.calledWith(502)).to.equal(true);
                expect(res.render.calledWith('pages/login', {
                    title: 'Login',
                    error: 'Google sign-in could not be completed. Verify the configured Google OAuth client secret and redirect URI for this environment.',
                    csrfToken: 'test-csrf-token'
                })).to.equal(true);
                expect(next.called).to.equal(false);
            } finally {
                if (originalClientId === undefined) {
                    delete process.env.GOOGLE_CLIENT_ID;
                } else {
                    process.env.GOOGLE_CLIENT_ID = originalClientId;
                }

                if (originalClientSecret === undefined) {
                    delete process.env.GOOGLE_CLIENT_SECRET;
                } else {
                    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
                }
            }
        });

        it('renders the same helpful login error when Google returns an InternalOAuthError', () => {
            const handler = getHandler('get', '/oauth2/redirect/google');
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

            try {
                process.env.GOOGLE_CLIENT_ID = 'client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

                sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                    expect(strategy).to.equal('google');
                    return () => callback({ name: 'InternalOAuthError', message: 'Failed to obtain access token' });
                });

                const req = {};
                const res = buildRes();
                const next = sinon.stub();

                handler(req, res, next);

                expect(res.status.calledWith(502)).to.equal(true);
                expect(res.render.calledWith('pages/login', {
                    title: 'Login',
                    error: 'Google sign-in could not be completed. Verify the configured Google OAuth client secret and redirect URI for this environment.',
                    csrfToken: 'test-csrf-token'
                })).to.equal(true);
                expect(next.called).to.equal(false);
            } finally {
                if (originalClientId === undefined) {
                    delete process.env.GOOGLE_CLIENT_ID;
                } else {
                    process.env.GOOGLE_CLIENT_ID = originalClientId;
                }

                if (originalClientSecret === undefined) {
                    delete process.env.GOOGLE_CLIENT_SECRET;
                } else {
                    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
                }
            }
        });

        it('regenerates the session and redirects home after a successful Google callback', async () => {
            const handler = getHandler('get', '/oauth2/redirect/google');
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

            try {
                process.env.GOOGLE_CLIENT_ID = 'client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

                sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                    expect(strategy).to.equal('google');
                    return () => callback(null, { id: 'google-user' }, null);
                });

                const req = {
                    session: {
                        regenerate: sinon.stub().callsFake((callback) => callback(null))
                    },
                    logIn: sinon.stub().callsFake((user, callback) => callback(null))
                };
                const res = buildRes();
                const next = sinon.stub();

                await handler(req, res, next);

                expect(req.session.regenerate.calledOnce).to.equal(true);
                expect(req.logIn.calledOnce).to.equal(true);
                expect(res.redirect.calledWith('/')).to.equal(true);
                expect(next.called).to.equal(false);
            } finally {
                if (originalClientId === undefined) {
                    delete process.env.GOOGLE_CLIENT_ID;
                } else {
                    process.env.GOOGLE_CLIENT_ID = originalClientId;
                }

                if (originalClientSecret === undefined) {
                    delete process.env.GOOGLE_CLIENT_SECRET;
                } else {
                    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
                }
            }
        });

        it('renders the account lockout message when Google sign-in reports a locked account', () => {
            const handler = getHandler('get', '/oauth2/redirect/google');
            const originalClientId = process.env.GOOGLE_CLIENT_ID;
            const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

            try {
                process.env.GOOGLE_CLIENT_ID = 'client-id';
                process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

                sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                    expect(strategy).to.equal('google');
                    return () => callback(null, false, { code: 'ACCOUNT_LOCKED', message: 'Account locked.' });
                });

                const req = {};
                const res = buildRes();
                const next = sinon.stub();

                handler(req, res, next);

                expect(res.render.calledWith('pages/login', {
                    title: 'Login',
                    error: 'This account is temporarily locked after repeated failed sign-in attempts. Please wait and try again.',
                    csrfToken: 'test-csrf-token'
                })).to.equal(true);
                expect(next.called).to.equal(false);
            } finally {
                if (originalClientId === undefined) {
                    delete process.env.GOOGLE_CLIENT_ID;
                } else {
                    process.env.GOOGLE_CLIENT_ID = originalClientId;
                }

                if (originalClientSecret === undefined) {
                    delete process.env.GOOGLE_CLIENT_SECRET;
                } else {
                    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
                }
            }
        });
    });

    describe('POST /login', () => {
        it('registers auth rate limiting before the login handler', () => {
            const layer = getRouteLayer('post', '/login');

            expect(layer).to.exist;
            expect(layer.route.stack).to.have.length(2);
            expect(layer.route.stack[0].handle).to.equal(authRateLimiter);
        });

        it('should render error if email is missing', () => {
            const handler = getHandler('post', '/login', 1);

            const req = {
                body: { password: 'password123' }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Please provide both email and password',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('should render error if password is missing', () => {
            const handler = getHandler('post', '/login', 1);

            const req = {
                body: { email: 'test@example.com' }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Please provide both email and password',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('should render error if email format is invalid', () => {
            const handler = getHandler('post', '/login', 1);

            const req = {
                body: {
                    email: 'invalid-email',
                    password: 'password123'
                }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/login');
            expect(res.render.firstCall.args[1].error).to.include('email');
        });

        it('should render a generic error when auth fails for a Google-only account', () => {
            const handler = getHandler('post', '/login', 1);

            const authenticateStub = sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return (req, res, next) => callback(null, false, { code: 'GOOGLE_AUTH_REQUIRED' });
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123'
                },
                logIn: sinon.stub()
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(authenticateStub.calledOnce).to.be.true;
            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Invalid email or password',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('should render passport info message when local auth fails', () => {
            const handler = getHandler('post', '/login', 1);

            sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return (req, res, next) => callback(null, false, { message: 'Invalid credentials.' });
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123'
                },
                logIn: sinon.stub()
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Invalid email or password',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('should render the account lockout message when passport reports a locked account', () => {
            const handler = getHandler('post', '/login', 1);

            sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return () => callback(null, false, { code: 'ACCOUNT_LOCKED', message: 'Account locked.' });
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123'
                },
                logIn: sinon.stub()
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'This account is temporarily locked after repeated failed sign-in attempts. Please wait and try again.',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('should allow the csrf field in login submissions', async () => {
            const handler = getHandler('post', '/login', 1);

            sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return (req, res, next) => callback(null, { id: 'user-123' }, null);
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123',
                    _csrf: 'test-csrf-token'
                },
                session: {
                    regenerate: sinon.stub().callsFake((callback) => callback(null))
                },
                logIn: sinon.stub().callsFake((user, callback) => callback(null))
            };
            const res = buildRes();
            const next = sinon.stub();

            await handler(req, res, next);

            expect(res.redirect.calledWith('/')).to.be.true;
            expect(next.called).to.be.false;
        });

        it('should regenerate the session before logging in and redirect home', async () => {
            const handler = getHandler('post', '/login', 1);

            sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return (req, res, next) => callback(null, { id: 'user-123' }, null);
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123'
                },
                session: {
                    regenerate: sinon.stub().callsFake((callback) => callback(null))
                },
                logIn: sinon.stub().callsFake((user, callback) => callback(null))
            };
            const res = buildRes();
            const next = sinon.stub();

            await handler(req, res, next);

            expect(req.session.regenerate.calledOnce).to.be.true;
            expect(req.logIn.calledOnce).to.be.true;
            expect(res.redirect.calledWith('/')).to.be.true;
            expect(next.called).to.be.false;
        });
    });

    describe('GET /signup', () => {
        it('should render the signup page', () => {
            const handler = getHandler('get', '/signup');

            const req = {};
            const res = buildRes();

            handler(req, res);

            expect(res.render.calledWith('pages/signup', {
                title: 'Sign Up',
                error: null,
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });
    });

    describe('GET /logout', () => {
        it('should redirect unauthenticated users to login', () => {
            const handler = getHandler('get', '/logout');

            const req = {};
            const res = buildRes();

            handler(req, res);

            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should render the logout confirmation page for authenticated users', () => {
            const handler = getHandler('get', '/logout');

            const req = {
                user: { id: 'user-123' }
            };
            const res = buildRes();

            handler(req, res);

            expect(res.render.calledWith('pages/logout', {
                title: 'Logout',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });
    });

    describe('POST /signup', () => {
        it('registers auth rate limiting before the signup handler', () => {
            const layer = getRouteLayer('post', '/signup');

            expect(layer).to.exist;
            expect(layer.route.stack).to.have.length(2);
            expect(layer.route.stack[0].handle).to.equal(authRateLimiter);
        });

        it('should create a new user with valid data', async () => {
            const handler = getHandler('post', '/signup', 1);

            sinon.stub(User, 'findOne').resolves(null);
            sinon.stub(User.prototype, 'save').resolves();
            sinon.stub(bcrypt, 'hash').resolves('hashedPassword123');

            const req = {
                body: {
                    email: 'newuser@example.com',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(User.findOne.calledWith({ email: 'newuser@example.com' })).to.be.true;
            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should allow the csrf field in signup submissions', async () => {
            const handler = getHandler('post', '/signup', 1);

            sinon.stub(User, 'findOne').resolves(null);
            sinon.stub(User.prototype, 'save').resolves();
            sinon.stub(bcrypt, 'hash').resolves('hashedPassword123');

            const req = {
                body: {
                    email: 'newuser@example.com',
                    password: 'ValidPass123',
                    _csrf: 'test-csrf-token'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should render error if email is invalid', async () => {
            const handler = getHandler('post', '/signup', 1);

            const req = {
                body: {
                    email: 'invalid-email',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/signup');
            expect(res.render.firstCall.args[1].error).to.include('email');
        });

        it('should render error if password is weak', async () => {
            const handler = getHandler('post', '/signup', 1);

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'weak'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/signup');
            expect(res.render.firstCall.args[1].error).to.exist;
        });

        it('should redirect to login if email is already registered', async () => {
            const handler = getHandler('post', '/signup', 1);

            const existingUser = {
                _id: new mongoose.Types.ObjectId(),
                email: 'existing@example.com'
            };

            sinon.stub(User, 'findOne').resolves(existingUser);

            const req = {
                body: {
                    email: 'existing@example.com',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });
    });

    describe('POST /logout', () => {
        it('should logout, destroy the session, clear the cookie, and redirect to login', async () => {
            const handler = getHandler('post', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(null)),
                session: {
                    destroy: sinon.stub().callsFake((callback) => callback(null))
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(req.logout.called).to.be.true;
            expect(req.session.destroy.called).to.be.true;
            expect(res.clearCookie.calledWith('connect.sid')).to.be.true;
            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('renders the logout page with a generic error if logout fails', async () => {
            const handler = getHandler('post', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(new Error('Logout error'))),
                session: {
                    destroy: sinon.stub()
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.status.calledWith(503)).to.be.true;
            expect(res.render.calledWith('pages/login', {
                title: 'Logout',
                error: 'Logout could not be completed safely.',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('renders the logout page with a generic error if session destruction fails after logout', async () => {
            const handler = getHandler('post', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(null)),
                session: {
                    destroy: sinon.stub().callsFake((callback) => callback(new Error('Session error')))
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.status.calledWith(503)).to.be.true;
            expect(res.render.calledWith('pages/login', {
                title: 'Logout',
                error: 'Logout could not be completed safely.',
                csrfToken: 'test-csrf-token'
            })).to.be.true;
        });

        it('renders a generic login error when the local auth service throws', () => {
            const handler = getHandler('post', '/login', 1);

            sinon.stub(passport, 'authenticate').callsFake((strategy, callback) => {
                expect(strategy).to.equal('local');
                return () => callback(new Error('database down'));
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123'
                }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.status.calledWith(503)).to.equal(true);
            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Authentication is temporarily unavailable. Please try again.',
                csrfToken: 'test-csrf-token'
            })).to.equal(true);
            expect(next.called).to.equal(false);
        });

        it('keeps GET /logout separate from the state-changing POST handler', () => {
            const postLayer = getRouteLayer('post', '/logout');
            const getLayer = getRouteLayer('get', '/logout');

            expect(postLayer).to.not.equal(null);
            expect(getLayer).to.not.equal(null);
        });
    });
});
