const path = require('path');

const express = require('express');
const helmet = require('helmet');

const authRoutes = require('../routes/authRoutes');
const settingsApiRoute = require('../routes/settingsApiRoutes');
const metricsRoute = require('../routes/metrics');
const breakGlassRoute = require('../routes/breakGlassRoutes');
const { registerFeatureRoutes } = require('./routeRegistry');
const { buildContentSecurityPolicyDirectives, buildHelmetProtectionOptions } = require('../config/xssDefense');
const { requireAuth } = require('../middleware/auth');
const { attachBreakGlassState, enforceBreakGlass } = require('../middleware/breakGlass');
const { ensureCsrfToken, requireCsrfProtection } = require('../middleware/csrf');
const { attachSessionAuthAssurance } = require('../middleware/sessionAuthAssurance');
const { enforceServerSideApiAccessControl } = require('../middleware/apiAccessControl');
const { enforceInjectionPrevention } = require('../middleware/injectionPrevention');
const { enforceStrictSessionManagement } = require('../middleware/sessionManagement');
const { sanitizeResponseMetadata } = require('../middleware/responseMetadataProtection');
const { createImmutableRequestAuditMiddleware } = require('../middleware/immutableRequestAudit');
const { requestContextMiddleware } = require('../utils/requestContext');
const { handleUnhandledError } = require('../utils/errorHandler');

function buildBreakGlassLocals(runtimeConfig = {}) {
    const breakGlass = runtimeConfig && runtimeConfig.breakGlass ? runtimeConfig.breakGlass : {};
    const mode = breakGlass.mode || 'disabled';

    return {
        mode,
        enabled: mode !== 'disabled',
        readOnly: mode === 'read_only',
        offline: mode === 'offline',
        reason: breakGlass.reason || '',
        activatedAt: mode === 'disabled' ? null : new Date().toISOString(),
        activatedBy: mode === 'disabled' ? '' : 'environment'
    };
}

function defaultRootRedirect(req, res) {
    return res.redirect('/notes');
}

function createApp({
    rootDir = path.join(__dirname, '..', '..'),
    runtimeConfig = {},
    mongooseLib = null,
    injectionPreventionPosture = {},
    immutableLogClient = null,
    passportInstance = null,
    sessionMiddleware = null,
    isProduction = false,
    appBaseUrl = '',
    realtimeAvailable = false,
    realtimeEnabled = false,
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
    const breakGlassLocals = buildBreakGlassLocals(runtimeConfig);
    const immutableLogging = runtimeConfig && runtimeConfig.immutableLogging ? runtimeConfig.immutableLogging : {};
    const transportSecurity = runtimeConfig && runtimeConfig.transport ? runtimeConfig.transport : {};
    const trustProxyHops = Number.isInteger(transportSecurity.trustProxyHops) ? transportSecurity.trustProxyHops : 0;

    app.disable('x-powered-by');

    if (trustProxyHops > 0) {
        app.set('trust proxy', trustProxyHops);
    }

    app.set('view engine', 'ejs');
    app.set('views', path.join(rootDir, 'src', 'views'));

    app.locals.runtimeConfig = runtimeConfig;
    app.locals.appBaseUrl = appBaseUrl || runtimeConfig.appBaseUrl || '';
    app.locals.realtimeAvailable = Boolean(realtimeAvailable);
    app.locals.realtimeEnabled = Boolean(realtimeEnabled);
    app.locals.mongooseLib = mongooseLib || null;
    app.locals.injectionPrevention = {
        requestGuardEnabled: true,
        ...injectionPreventionPosture
    };
    app.locals.xssDefense = {
        escapedServerRendering: true,
        strictCspEnabled: true,
        directives: buildContentSecurityPolicyDirectives()
    };
    app.locals.transportSecurity = transportSecurity;
    app.locals.immutableLogging = immutableLogging;
    app.locals.immutableLogClient = immutableLogClient || null;
    app.locals.breakGlass = breakGlassLocals;

    Object.assign(app.locals, additionalLocals);

    app.use(sanitizeResponseMetadata);
    app.use(helmet(buildHelmetProtectionOptions({ isProduction })));
    app.use(requestContextMiddleware);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(enforceInjectionPrevention);
    app.use(createImmutableRequestAuditMiddleware({ client: immutableLogClient }));
    app.use('/vendor/bootstrap', express.static(path.join(rootDir, 'node_modules', 'bootstrap', 'dist')));
    app.use('/vendor/bootstrap-icons', express.static(path.join(rootDir, 'node_modules', 'bootstrap-icons')));
    app.use(express.static(path.join(rootDir, 'src', 'views', 'public')));

    app.get('/placeholder.jpg', (req, res) => {
        res.sendFile(path.join(rootDir, 'src', 'image', 'placeholder.jpg'));
    });

    if (sessionMiddleware) {
        app.use(sessionMiddleware);
    }

    if (passportInstance) {
        app.use(passportInstance.initialize());
        app.use(passportInstance.session());
    }

    if (typeof injectSessionPrincipal === 'function') {
        app.use(injectSessionPrincipal);
    }

    app.use(enforceStrictSessionManagement);
    app.use(attachSessionAuthAssurance);
    app.use(enforceServerSideApiAccessControl);
    app.use(ensureCsrfToken);
    app.use(requireCsrfProtection);
    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });
    app.use(attachBreakGlassState);

    app.get('/healthz', (req, res) => {
        const breakGlass = req.app && req.app.locals ? req.app.locals.breakGlass : null;
        const offline = Boolean(breakGlass && breakGlass.offline);

        return res.status(offline ? 503 : 200).json({
            ok: !offline,
            breakGlass: {
                mode: breakGlass && breakGlass.mode ? breakGlass.mode : 'disabled',
                enabled: Boolean(breakGlass && breakGlass.enabled)
            }
        });
    });

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

    app.use(handleUnhandledError);

    return app;
}

module.exports = {
    buildBreakGlassLocals,
    createApp
};
