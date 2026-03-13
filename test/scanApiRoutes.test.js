const { expect } = require('chai');

const router = require('../src/routes/scanApiRoutes');
const scanApiController = require('../src/controllers/scanApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

const findRouteLayer = (method, path) => {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
};

describe('Scan API Routes', () => {
    it('registers both scan API routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('maps GET /api/security/scans to getScans with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/security/scans');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(scanApiController.getScans);
    });

    it('maps POST /api/security/scan-import to importScan with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/security/scan-import');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(scanApiController.importScan);
    });
});
