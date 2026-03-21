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
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return body;
        }
    };
};

describe('Dev Runtime Routes', () => {
    it('registers all dev runtime routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(3);
    });

    it('returns runtime config from app locals', async () => {
        const layer = findRouteLayer('get', '/__runtime-config');
        const req = {
            app: {
                locals: {
                    runtimeConfig: { appBaseUrl: 'http://localhost:3000' }
                }
            }
        };
        const res = buildRes();

        await layer.route.stack[0].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.deep.equal({
            runtimeConfig: { appBaseUrl: 'http://localhost:3000' }
        });
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

        await layer.route.stack[0].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.include({
            realtimeAvailable: true,
            realtimeEnabled: false,
            sseMounted: true
        });
    });

    it('maps POST /api/runtime/realtime with API auth middleware', () => {
        const layer = findRouteLayer('post', '/api/runtime/realtime');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
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

        await layer.route.stack[1].handle(req, res);

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

        await layer.route.stack[1].handle(req, res);

        expect(res.statusCode).to.equal(400);
        expect(res.payload).to.deep.equal({
            success: false,
            message: 'enabled must be a boolean or the string true/false'
        });
    });
});
