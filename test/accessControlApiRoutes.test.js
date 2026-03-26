const { expect } = require('chai');

const router = require('../src/routes/accessControlApiRoutes');
const accessControlApiController = require('../src/controllers/accessControlApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Access control API routes', () => {
    it('registers both access-control API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/access-control/overview with auth and controller middleware', () => {
        const layer = findRouteLayer('get', '/api/access-control/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(accessControlApiController.getOverview);
    });

    it('maps POST /api/access-control/evaluate with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/access-control/evaluate');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(accessControlApiController.evaluateScenario);
    });
});
