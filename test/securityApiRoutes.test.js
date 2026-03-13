const { expect } = require('chai');

const router = require('../src/routes/securityApiRoutes');
const securityApiController = require('../src/controllers/securityApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

const findRouteLayer = (method, path) => {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
};

describe('Security API Routes', () => {
    it('registers all security API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/security/alerts to getAlerts with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/security/alerts');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityApiController.getAlerts);
    });

    it('maps POST /api/security/log-analysis to analyzeLogs with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/security/log-analysis');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityApiController.analyzeLogs);
    });
});
