const { expect } = require('chai');

const router = require('../src/routes/xssDefenseApiRoutes');
const xssDefenseApiController = require('../src/controllers/xssDefenseApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('XSS defense API routes', () => {
    it('registers both xss-defense API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/xss-defense/overview with auth and controller middleware', () => {
        const layer = findRouteLayer('get', '/api/xss-defense/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(xssDefenseApiController.getOverview);
    });

    it('maps POST /api/xss-defense/evaluate with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/xss-defense/evaluate');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(xssDefenseApiController.evaluateScenario);
    });
});
