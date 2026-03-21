const { expect } = require('chai');

const router = require('../src/routes/mlApiRoutes');
const mlApiController = require('../src/controllers/mlApiController');
const { requireAuthAPI } = require('../src/middleware/auth');
const { securityAnalysisRateLimiter } = require('../src/middleware/rateLimit');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('ML API Routes', () => {
    it('registers all ML API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/ml/overview to getOverview with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/ml/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(mlApiController.getOverview);
    });

    it('maps POST /api/ml/train to trainModel with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/ml/train');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityAnalysisRateLimiter);
        expect(layer.route.stack[2].handle).to.equal(mlApiController.trainModel);
    });
});
