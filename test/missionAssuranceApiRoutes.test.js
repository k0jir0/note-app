const { expect } = require('chai');

const router = require('../src/routes/missionAssuranceApiRoutes');
const missionAssuranceApiController = require('../src/controllers/missionAssuranceApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Mission assurance API routes', () => {
    it('registers both mission assurance API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/mission-assurance/overview with auth and controller middleware', () => {
        const layer = findRouteLayer('get', '/api/mission-assurance/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(missionAssuranceApiController.getOverview);
    });

    it('maps POST /api/mission-assurance/evaluate with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/mission-assurance/evaluate');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(missionAssuranceApiController.evaluateDecision);
    });
});
