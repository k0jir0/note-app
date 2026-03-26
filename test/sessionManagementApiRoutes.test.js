const { expect } = require('chai');

const router = require('../src/routes/sessionManagementApiRoutes');
const { requireAuthAPI } = require('../src/middleware/auth');

function getRouteLayer(method, path) {
    return router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
}

describe('Session management API routes', () => {
    it('registers both session management API routes', () => {
        const routes = router.stack.filter((entry) => entry.route).map((entry) => entry.route.path);

        expect(routes).to.deep.equal([
            '/api/session-management/overview',
            '/api/session-management/evaluate'
        ]);
    });

    it('maps GET /api/session-management/overview with auth and controller middleware', () => {
        const layer = getRouteLayer('get', '/api/session-management/overview');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('maps POST /api/session-management/evaluate with auth and controller middleware', () => {
        const layer = getRouteLayer('post', '/api/session-management/evaluate');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
    });
});
