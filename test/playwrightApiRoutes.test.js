const { expect } = require('chai');

const router = require('../src/routes/playwrightApiRoutes');
const playwrightApiController = require('../src/controllers/playwrightApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Playwright API Routes', () => {
    it('registers all Playwright API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/playwright/overview to getOverview with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/playwright/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(playwrightApiController.getOverview);
    });

    it('maps GET /api/playwright/script to getScript with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/playwright/script');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(playwrightApiController.getScript);
    });
});
