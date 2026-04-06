const { expect } = require('chai');
const sinon = require('sinon');

const {
    FEATURE_ROUTE_GROUPS,
    FEATURE_ROUTES,
    registerFeatureRoutes
} = require('../src/app/routeRegistry');

describe('feature route registry', () => {
    it('organizes feature routes into named groups without losing the flat export', () => {
        expect(FEATURE_ROUTE_GROUPS.map((group) => group.name)).to.deep.equal([
            'notes-and-workspace',
            'analysis-and-operations',
            'control-modules',
            'assurance-and-telemetry'
        ]);

        expect(FEATURE_ROUTES).to.deep.equal(
            FEATURE_ROUTE_GROUPS.flatMap((group) => group.routes)
        );
        expect(FEATURE_ROUTES).to.have.length(31);
    });

    it('registers every route from the grouped registry by default', () => {
        const app = { use: sinon.spy() };

        registerFeatureRoutes(app);

        expect(app.use.callCount).to.equal(FEATURE_ROUTES.length);
        expect(app.use.firstCall.args[0]).to.equal(FEATURE_ROUTES[0]);
        expect(app.use.lastCall.args[0]).to.equal(FEATURE_ROUTES[FEATURE_ROUTES.length - 1]);
    });

    it('accepts a flat custom route array for focused app assembly', () => {
        const app = { use: sinon.spy() };
        const customRoutes = [{ id: 'route-a' }, { id: 'route-b' }];

        registerFeatureRoutes(app, customRoutes);

        expect(app.use.callCount).to.equal(2);
        expect(app.use.firstCall.args[0]).to.equal(customRoutes[0]);
        expect(app.use.secondCall.args[0]).to.equal(customRoutes[1]);
    });
});
