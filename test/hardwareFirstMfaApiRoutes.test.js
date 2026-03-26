const { expect } = require('chai');

const router = require('../src/routes/hardwareFirstMfaApiRoutes');
const hardwareFirstMfaApiController = require('../src/controllers/hardwareFirstMfaApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Hardware-first MFA API routes', () => {
    it('registers all hardware-first MFA API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(4);
    });

    it('maps GET /api/hardware-mfa/overview with auth and controller middleware', () => {
        const layer = findRouteLayer('get', '/api/hardware-mfa/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(hardwareFirstMfaApiController.getOverview);
    });

    it('maps POST /api/hardware-mfa/challenge with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/hardware-mfa/challenge');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(hardwareFirstMfaApiController.issueChallenge);
    });

    it('maps POST /api/hardware-mfa/verify with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/hardware-mfa/verify');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(hardwareFirstMfaApiController.verifyChallenge);
    });

    it('maps POST /api/hardware-mfa/revoke with auth and controller middleware', () => {
        const layer = findRouteLayer('post', '/api/hardware-mfa/revoke');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[2].handle).to.equal(hardwareFirstMfaApiController.revokeSession);
    });
});
