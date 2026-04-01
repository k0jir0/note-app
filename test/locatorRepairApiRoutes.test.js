const { expect } = require('chai');

const router = require('../src/routes/locatorRepairApiRoutes');
const locatorRepairApiController = require('../src/controllers/locatorRepairApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Locator repair API Routes', () => {
    it('registers all locator repair API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(5);
    });

    it('maps GET /api/locator-repair/overview to getOverview with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/locator-repair/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(locatorRepairApiController.getOverview);
    });

    it('maps GET /api/locator-repair/history to getHistory with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/locator-repair/history');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(locatorRepairApiController.getHistory);
    });

    it('maps POST /api/locator-repair/suggest to suggestRepairs with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/locator-repair/suggest');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(locatorRepairApiController.suggestRepairs);
    });

    it('maps POST /api/locator-repair/feedback to recordFeedback with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/locator-repair/feedback');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(locatorRepairApiController.recordFeedback);
    });

    it('maps POST /api/locator-repair/train to trainModel with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/locator-repair/train');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(locatorRepairApiController.trainModel);
    });
});
