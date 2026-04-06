const { expect } = require('chai');
const http = require('http');
const path = require('path');
const session = require('express-session');

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

function createDiagnosticsApp() {
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
        immutableLogClient: {
            enabled: true,
            getDeliveryState: () => ({
                healthy: true,
                degraded: false,
                requireRemoteSuccess: true
            })
        },
        sessionMiddleware: session({
            secret: 'test-session-secret-that-is-long-enough',
            resave: false,
            saveUninitialized: true
        }),
        injectSessionPrincipal: (req, res, next) => {
            const missionRole = typeof req.get === 'function'
                ? String(req.get('x-test-user-role') || '').trim().toLowerCase()
                : '';

            if (missionRole) {
                req.user = {
                    _id: '507f1f77bcf86cd799439011',
                    email: `${missionRole}@example.com`,
                    accessProfile: {
                        missionRole
                    }
                };
                req.isAuthenticated = () => true;
            } else {
                req.isAuthenticated = () => false;
            }

            next();
        },
        includeSettingsApiRoute: false,
        includeBreakGlassRoute: false,
        includeFeatureRoutes: false,
        includeRootRedirect: false
    });
}

describe('health route diagnostics protection', () => {
    afterEach(() => {
        delete process.env.METRICS_AUTH_TOKEN;
    });

    it('returns only public readiness state to anonymous callers', async () => {
        const app = createDiagnosticsApp();
        const server = http.createServer(app);

        await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
            const body = await response.json();

            expect(response.status).to.equal(200);
            expect(body).to.deep.equal({
                ok: true,
                detailsRestricted: true
            });
        } finally {
            await close(server);
        }
    });

    it('returns full diagnostics to authenticated admin sessions', async () => {
        const app = createDiagnosticsApp();
        const server = http.createServer(app);

        await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/healthz`, {
                headers: {
                    'x-test-user-role': 'admin'
                }
            });
            const body = await response.json();

            expect(response.status).to.equal(200);
            expect(body.detailsRestricted).to.equal(false);
            expect(body.breakGlass).to.deep.equal({
                mode: 'disabled',
                enabled: false
            });
            expect(body.immutableLogging).to.deep.equal({
                enabled: true,
                healthy: true,
                degraded: false,
                requireRemoteSuccess: true
            });
        } finally {
            await close(server);
        }
    });

    it('returns full diagnostics to callers with the scraper bearer token', async () => {
        process.env.METRICS_AUTH_TOKEN = 'diag-token';

        const app = createDiagnosticsApp();
        const server = http.createServer(app);

        await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/healthz`, {
                headers: {
                    authorization: 'Bearer diag-token'
                }
            });
            const body = await response.json();

            expect(response.status).to.equal(200);
            expect(body.detailsRestricted).to.equal(false);
            expect(body.immutableLogging.enabled).to.equal(true);
        } finally {
            await close(server);
        }
    });
});
