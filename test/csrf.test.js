const { expect } = require('chai');
const http = require('http');
const path = require('path');
const sinon = require('sinon');
const session = require('express-session');

const {
    CSRF_BODY_FIELD,
    CSRF_HEADER_NAME,
    ensureCsrfToken,
    requireCsrfProtection,
    isValidCsrfToken
} = require('../src/middleware/csrf');
const { createApp } = require('../src/app/createApp');

function listen(server) {
    return new Promise((resolve, reject) => {
        server.listen(0, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function createIntegrationApp() {
    return createApp({
        rootDir: path.join(__dirname, '..'),
        runtimeConfig: {
            sessionManagement: {
                idleTimeoutMs: 15 * 60 * 1000,
                absoluteTimeoutMs: 8 * 60 * 60 * 1000,
                missionIdleTimeoutMs: 5 * 60 * 1000,
                missionAbsoluteTimeoutMs: 2 * 60 * 60 * 1000,
                preventConcurrentLogins: true
            }
        },
        sessionMiddleware: session({
            secret: 'test-session-secret-that-is-long-enough',
            resave: false,
            saveUninitialized: true
        }),
        includeSettingsApiRoute: false,
        includeMetricsRoute: false,
        includeBreakGlassRoute: false,
        includeFeatureRoutes: false,
        includeRootRedirect: false
    });
}

describe('CSRF Middleware', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('creates a csrf token in session and exposes it to views', () => {
        const req = { session: {} };
        const res = { locals: {} };
        const next = sinon.stub();

        ensureCsrfToken(req, res, next);

        expect(req.session.csrfToken).to.be.a('string');
        expect(req.session.csrfToken).to.have.length.greaterThan(0);
        expect(res.locals.csrfToken).to.equal(req.session.csrfToken);
        expect(res.locals.csrfFieldName).to.equal(CSRF_BODY_FIELD);
        expect(res.locals.csrfHeaderName).to.equal(CSRF_HEADER_NAME);
        expect(next.calledOnce).to.be.true;
    });

    it('accepts safe methods without requiring a token', () => {
        const req = { method: 'GET' };
        const res = {};
        const next = sinon.stub();

        requireCsrfProtection(req, res, next);

        expect(next.calledOnce).to.be.true;
    });

    it('rejects api requests with missing csrf token', () => {
        const req = {
            method: 'POST',
            originalUrl: '/api/notes',
            path: '/api/notes',
            session: { csrfToken: 'expected-token' },
            headers: {},
            body: {}
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };
        const next = sinon.stub();

        requireCsrfProtection(req, res, next);

        expect(res.status.calledWith(403)).to.be.true;
        expect(res.json.calledWith({ success: false, message: 'Invalid CSRF token' })).to.be.true;
        expect(next.called).to.be.false;
    });

    it('accepts api requests with a valid csrf header token', () => {
        const req = {
            method: 'POST',
            originalUrl: '/api/notes',
            path: '/api/notes',
            session: { csrfToken: 'expected-token' },
            headers: { [CSRF_HEADER_NAME]: 'expected-token' },
            body: {}
        };
        const res = {};
        const next = sinon.stub();

        requireCsrfProtection(req, res, next);

        expect(next.calledOnce).to.be.true;
    });

    it('rejects login form submissions with an invalid csrf token', () => {
        const req = {
            method: 'POST',
            originalUrl: '/auth/login',
            path: '/auth/login',
            session: { csrfToken: 'expected-token' },
            headers: {},
            body: { _csrf: 'wrong-token' }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            render: sinon.stub()
        };
        const next = sinon.stub();

        requireCsrfProtection(req, res, next);

        expect(res.status.calledWith(403)).to.be.true;
        expect(res.render.calledWith('pages/login', {
            title: 'Login',
            error: 'Your session expired. Please try again.'
        })).to.be.true;
        expect(next.called).to.be.false;
    });

    it('renders the login page for invalid csrf submissions without crashing when no user is authenticated', async () => {
        const app = createIntegrationApp();
        const server = http.createServer(app);

        await listen(server);

        try {
            const baseUrl = `http://127.0.0.1:${server.address().port}`;
            const loginPage = await fetch(`${baseUrl}/auth/login`);
            const cookieHeader = loginPage.headers.get('set-cookie').split(';')[0];
            const response = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    cookie: cookieHeader
                },
                body: 'email=test%40example.com&password=Password123&_csrf=invalid-token',
                redirect: 'manual'
            });

            const body = await response.text();

            expect(response.status).to.equal(403);
            expect(body).to.include('Your session expired. Please try again.');
        } finally {
            await close(server);
        }
    });

    it('compares csrf tokens safely', () => {
        expect(isValidCsrfToken('token-123', 'token-123')).to.equal(true);
        expect(isValidCsrfToken('token-123', 'token-456')).to.equal(false);
        expect(isValidCsrfToken('token-123', '')).to.equal(false);
    });
});
