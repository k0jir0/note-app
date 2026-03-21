const { expect } = require('chai');

const router = require('../src/routes/seleniumApiRoutes');
const seleniumApiController = require('../src/controllers/seleniumApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Selenium API Routes', () => {
    it('registers all Selenium API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/selenium/overview to getOverview with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/selenium/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(seleniumApiController.getOverview);
    });

    it('maps GET /api/selenium/script to getScript with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/selenium/script');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(seleniumApiController.getScript);
    });
});
