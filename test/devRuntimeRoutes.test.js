const { expect } = require('chai');

const router = require('../src/routes/devRuntimeRoutes');
const { requireAuthAPI } = require('../src/middleware/auth');

const findRouteLayer = (method, path) => {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
};

const buildRes = () => {
    return {
        statusCode: 200,
        payload: null,
        sent: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return body;
        },
        send(body) {
            this.sent = body;
            return body;
        }
    };
};

describe('Dev Runtime Routes', () => {
    it('registers all dev runtime routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(3);
    });

    it('protects the diagnostic GET routes with auth, tooling gates, and privileged-read access', () => {
        const runtimeConfigLayer = findRouteLayer('get', '/__runtime-config');
        const realtimeStatusLayer = findRouteLayer('get', '/__realtime-status');

        expect(runtimeConfigLayer).to.exist;
        expect(runtimeConfigLayer.route.stack).to.have.length(4);
        expect(runtimeConfigLayer.route.stack[0].handle).to.equal(requireAuthAPI);

        expect(realtimeStatusLayer).to.exist;
        expect(realtimeStatusLayer.route.stack).to.have.length(4);
        expect(realtimeStatusLayer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('rejects diagnostics when privileged dev tooling is disabled', async () => {
        const layer = findRouteLayer('get', '/__runtime-config');
        const req = {
            app: {
                locals: {
                    privilegedDevToolsEnabled: false
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[1].handle(req, res, () => {});

        expect(res.statusCode).to.equal(403);
        expect(res.payload.message).to.equal('Privileged development tooling is disabled for this environment.');
    });

    it('returns a sanitized runtime config from app locals', async () => {
        const layer = findRouteLayer('get', '/__runtime-config');
        const req = {
            app: {
                locals: {
                    runtimeConfig: {
                        dbURI: 'mongodb://localhost:27017/noteApp',
                        database: {
                            tlsRequired: false,
                            tlsEnabled: false,
                            local: true
                        },
                        sessionSecret: 'super-secret-value',
                        noteEncryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                        cipherAlgo: 'aes-256-gcm',
                        appBaseUrl: 'http://localhost:3000',
                        googleAuthEnabled: true
                    }
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[3].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload.runtimeConfig).to.include({
            dbConfigured: true,
            sessionSecretConfigured: true,
            noteEncryptionConfigured: true,
            cipherAlgo: 'aes-256-gcm',
            appBaseUrl: 'http://localhost:3000',
            googleAuthEnabled: true
        });
        expect(res.payload.runtimeConfig.database).to.deep.equal({
            tlsRequired: false,
            tlsEnabled: false,
            local: true
        });
        expect(res.payload.runtimeConfig).to.not.have.property('dbURI');
        expect(res.payload.runtimeConfig).to.not.have.property('sessionSecret');
        expect(res.payload.runtimeConfig).to.not.have.property('noteEncryptionKey');
    });

    it('returns realtime status without router stack introspection', async () => {
        const layer = findRouteLayer('get', '/__realtime-status');
        const req = {
            app: {
                locals: {
                    realtimeAvailable: true,
                    realtimeEnabled: false
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[3].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.include({
            realtimeAvailable: true,
            realtimeEnabled: false,
            sseMounted: true
        });
    });

    it('maps POST /api/runtime/realtime with the new privileged runtime middleware chain', () => {
        const layer = findRouteLayer('post', '/api/runtime/realtime');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(5);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('toggles realtime when a boolean-like payload is provided', async () => {
        const layer = findRouteLayer('post', '/api/runtime/realtime');
        const req = {
            body: { enabled: 'true' },
            app: {
                locals: {
                    realtimeAvailable: true,
                    realtimeEnabled: false
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[4].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(req.app.locals.realtimeEnabled).to.equal(true);
        expect(res.payload).to.deep.equal({
            success: true,
            realtimeEnabled: true
        });
    });

    it('rejects invalid runtime toggle payloads', async () => {
        const layer = findRouteLayer('post', '/api/runtime/realtime');
        const req = {
            body: { enabled: 'sometimes' },
            app: {
                locals: {
                    realtimeAvailable: true,
                    realtimeEnabled: false
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[4].handle(req, res);

        expect(res.statusCode).to.equal(400);
        expect(res.payload).to.deep.equal({
            success: false,
            message: 'enabled must be a boolean or the string true/false'
        });
    });
});
