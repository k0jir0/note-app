const { expect } = require('chai');

const router = require('../src/routes/auditTelemetryApiRoutes');
const auditTelemetryApiController = require('../src/controllers/auditTelemetryApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

function findRouteLayer(method, path) {
    return router.stack.find(
        (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
    );
}

describe('Audit telemetry API routes', () => {
    it('registers the audit telemetry API route', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(1);
    });

    it('maps GET /api/audit-telemetry/events with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/audit-telemetry/events');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(auditTelemetryApiController.getEvents);
    });
});
