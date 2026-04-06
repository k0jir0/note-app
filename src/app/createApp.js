const path = require('path');

const express = require('express');
const { applyApplicationLocals, buildBreakGlassLocals } = require('./appLocals');
const { registerApplicationMiddleware } = require('./middlewareStack');
const { registerHealthRoute } = require('./healthRoute');
const { defaultRootRedirect, registerApplicationRoutes } = require('./coreRoutes');
const { handleUnhandledError } = require('../utils/errorHandler');

function configureApplicationShell(app, { rootDir, runtimeConfig = {} } = {}) {
    const transportSecurity = runtimeConfig && runtimeConfig.transport ? runtimeConfig.transport : {};
    const trustProxyHops = Number.isInteger(transportSecurity.trustProxyHops) ? transportSecurity.trustProxyHops : 0;

    app.disable('x-powered-by');

    if (trustProxyHops > 0) {
        app.set('trust proxy', trustProxyHops);
    }

    app.set('view engine', 'ejs');
    app.set('views', path.join(rootDir, 'src', 'views'));

    return app;
}

function createApp({
    rootDir = path.join(__dirname, '..', '..'),
    runtimeConfig = {},
    mongooseLib = null,
    injectionPreventionPosture = {},
    immutableLogClient = null,
    breakGlassStateStore = null,
    passportInstance = null,
    sessionMiddleware = null,
    isProduction = false,
    appBaseUrl = '',
    realtimeAvailable = false,
    realtimeEnabled = false,
    privilegedDevToolsEnabled = false,
    includeAuthRoutes = true,
    includeSettingsApiRoute = true,
    includeMetricsRoute = true,
    includeBreakGlassRoute = true,
    includeFeatureRoutes = true,
    includeRootRedirect = true,
    rootRedirectHandler = defaultRootRedirect,
    registerAdditionalRoutes = null,
    injectSessionPrincipal = null,
    additionalLocals = {}
} = {}) {
    const app = express();
    configureApplicationShell(app, { rootDir, runtimeConfig });
    applyApplicationLocals(app, {
        runtimeConfig,
        mongooseLib,
        injectionPreventionPosture,
        immutableLogClient,
        breakGlassStateStore,
        appBaseUrl,
        realtimeAvailable,
        realtimeEnabled,
        privilegedDevToolsEnabled,
        additionalLocals
    });
    registerApplicationMiddleware(app, {
        rootDir,
        isProduction,
        immutableLogClient,
        sessionMiddleware,
        passportInstance,
        injectSessionPrincipal
    });
    registerHealthRoute(app);
    registerApplicationRoutes(app, {
        includeAuthRoutes,
        includeSettingsApiRoute,
        includeMetricsRoute,
        includeBreakGlassRoute,
        includeFeatureRoutes,
        includeRootRedirect,
        rootRedirectHandler,
        registerAdditionalRoutes
    });

    app.use(handleUnhandledError);

    return app;
}

module.exports = {
    buildBreakGlassLocals,
    createApp
};
