const { expect } = require('chai');

const router = require('../src/routes/devSeedRoutes');
const { requireAuth } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
}

function createRes() {
    return {
        statusCode: 200,
        payload: null,
        sent: null,
        typeValue: '',
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
        },
        type(value) {
            this.typeValue = value;
            return this;
        }
    };
}

describe('Dev seed routes', () => {
    it('protects the seed endpoint with auth and privileged runtime middleware', () => {
        const layer = findRouteLayer('post', '/seed');

        expect(layer).to.exist;
        expect(layer.route.stack[0].handle).to.equal(requireAuth);
        expect(layer.route.stack).to.have.length(6);
    });

    it('rejects seed requests when privileged development tooling is disabled', async () => {
        const layer = findRouteLayer('post', '/seed');
        const req = {
            app: {
                locals: {
                    privilegedDevToolsEnabled: false
                }
            }
        };
        const res = createRes();

        await layer.route.stack[1].handle(req, res, () => {});

        expect(res.statusCode).to.equal(403);
        expect(res.sent).to.equal('Privileged development tooling is disabled for this environment.');
    });
});
