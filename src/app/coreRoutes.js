const authRoutes = require('../routes/authRoutes');
const settingsApiRoute = require('../routes/settingsApiRoutes');
const metricsRoute = require('../routes/metrics');
const breakGlassRoute = require('../routes/breakGlassRoutes');
const { requireAuth } = require('../middleware/auth');
const { enforceBreakGlass } = require('../middleware/breakGlass');
const { registerFeatureRoutes } = require('./routeRegistry');

function defaultRootRedirect(req, res) {
    return res.redirect('/notes');
}

function registerApplicationRoutes(app, {
    includeAuthRoutes = true,
    includeSettingsApiRoute = true,
    includeMetricsRoute = true,
    includeBreakGlassRoute = true,
    includeFeatureRoutes = true,
    includeRootRedirect = true,
    rootRedirectHandler = defaultRootRedirect,
    registerAdditionalRoutes = null
} = {}) {
    app.use(enforceBreakGlass);

    if (includeBreakGlassRoute) {
        app.use(breakGlassRoute);
    }

    if (includeAuthRoutes) {
        app.use('/auth', authRoutes);
    }

    if (includeSettingsApiRoute) {
        app.use(settingsApiRoute);
    }

    if (includeMetricsRoute) {
        app.use(metricsRoute.router);
    }

    if (includeRootRedirect) {
        app.get('/', requireAuth, rootRedirectHandler);
    }

    if (typeof registerAdditionalRoutes === 'function') {
        registerAdditionalRoutes(app);
    }

    if (includeFeatureRoutes) {
        registerFeatureRoutes(app);
    }

    return app;
}

module.exports = {
    defaultRootRedirect,
    registerApplicationRoutes
};
