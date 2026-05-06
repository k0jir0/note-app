const { expect } = require('chai');
const session = require('express-session');

const { createApp } = require('../src/app/createApp');
const { validateRuntimeConfig } = require('../src/config/runtimeConfig');
const { closeServer } = require('./support/appFlowsTestSupport');

describe('protected runtime app smoke', function () {
    let server;
    let baseUrl;

    afterEach(async function () {
        if (server) {
            await closeServer(server);
            server = null;
        }
    });

    function createProtectedRuntimeConfig() {
        return validateRuntimeConfig({
            NODE_ENV: 'staging',
            APP_BASE_URL: 'https://note-app.example.gov',
            MONGODB_URI: 'mongodb://127.0.0.1:27017/noteAppProtectedCi?tls=true',
            SESSION_SECRET: 'ci-session-secret-0123456789abcdef',
            NOTE_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            TRUST_PROXY_HOPS: '1',
            IMMUTABLE_LOGGING_ENABLED: 'true',
            IMMUTABLE_LOGGING_URL: 'https://logs.example.gov/append',
            IMMUTABLE_LOGGING_TOKEN: 'ci-log-token',
            SELF_SIGNUP_ENABLED: 'false',
            GOOGLE_AUTO_PROVISION_ENABLED: 'false'
        });
    }

    async function startProtectedRuntimeApp() {
        const app = createApp({
            runtimeConfig: createProtectedRuntimeConfig(),
            sessionMiddleware: session({
                secret: 'protected-runtime-smoke-secret-0123456789abcdef',
                resave: false,
                saveUninitialized: false
            }),
            includeAuthRoutes: false,
            includeSettingsApiRoute: false,
            includeMetricsRoute: false,
            includeBreakGlassRoute: false,
            includeFeatureRoutes: false,
            includeRootRedirect: false
        });

        server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    }

    it('rejects insecure direct health probes in protected runtime mode', async function () {
        await startProtectedRuntimeApp();

        const response = await fetch(`${baseUrl}/healthz`);
        const payload = await response.json();

        expect(response.status).to.equal(400);
        expect(payload.message).to.equal('HTTPS is required in this environment');
    });

    it('accepts health probes forwarded by a trusted local TLS-terminating proxy', async function () {
        await startProtectedRuntimeApp();

        const response = await fetch(`${baseUrl}/healthz`, {
            headers: {
                'x-forwarded-proto': 'https'
            }
        });
        const payload = await response.json();

        expect(response.status).to.equal(200);
        expect(payload).to.deep.equal({
            ok: true,
            detailsRestricted: true
        });
    });
});
