const { expect } = require('chai');

const router = require('../src/routes/securityApiRoutes');
const securityApiController = require('../src/controllers/securityApiController');
const { requireAuthAPI } = require('../src/middleware/auth');
const { securityAnalysisRateLimiter } = require('../src/middleware/rateLimit');

const findRouteLayer = (method, path) => {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
};

describe('Security API Routes', () => {
    it('registers all security API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(4);
    });

    it('maps GET /api/security/alerts to getAlerts with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/security/alerts');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityApiController.getAlerts);
    });

    it('maps GET /api/security/correlations to getCorrelations with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/security/correlations');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityApiController.getCorrelations);
    });

    it('maps POST /api/security/correlations/sample to getSampleCorrelations with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/security/correlations/sample');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityAnalysisRateLimiter);
        expect(layer.route.stack[2].handle).to.equal(securityApiController.getSampleCorrelations);
    });

    it('maps POST /api/security/log-analysis to analyzeLogs with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/security/log-analysis');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(securityAnalysisRateLimiter);
        expect(layer.route.stack[2].handle).to.equal(securityApiController.analyzeLogs);
    });
});
