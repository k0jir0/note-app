const { expect } = require('chai');

const router = require('../src/routes/injectionPreventionApiRoutes');
const injectionPreventionApiController = require('../src/controllers/injectionPreventionApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Injection prevention API routes', () => {
    it('registers both injection-prevention API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/injection-prevention/overview with auth and controller middleware', () => {
        const layer = findRouteLayer('get', '/api/injection-prevention/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(injectionPreventionApiController.getOverview);
    });

    it('maps POST /api/injection-prevention/evaluate with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/injection-prevention/evaluate');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(injectionPreventionApiController.evaluateScenario);
    });
});
