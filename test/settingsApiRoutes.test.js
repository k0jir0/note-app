const { expect } = require('chai');

const router = require('../src/routes/settingsApiRoutes');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
}

describe('settings API routes', () => {
    it('registers the theme and account-management routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);
        expect(routeLayers).to.have.length(4);
    });

    it('protects theme preference updates with API auth', () => {
        const layer = findRouteLayer('post', '/api/settings/theme');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('protects account listing with API auth and privileged-read access', () => {
        const layer = findRouteLayer('get', '/api/settings/accounts');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('protects account provisioning with API auth, privileged mutation access, and recent step-up', () => {
        const layer = findRouteLayer('post', '/api/settings/accounts');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(4);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('protects account-state updates with API auth, privileged mutation access, and recent step-up', () => {
        const layer = findRouteLayer('patch', '/api/settings/accounts/:userId/state');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(4);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });
});
