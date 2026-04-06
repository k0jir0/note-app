const { buildContentSecurityPolicyDirectives } = require('../config/xssDefense');

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

function applyApplicationLocals(app, {
    runtimeConfig = {},
    mongooseLib = null,
    injectionPreventionPosture = {},
    immutableLogClient = null,
    breakGlassStateStore = null,
    appBaseUrl = '',
    realtimeAvailable = false,
    realtimeEnabled = false,
    privilegedDevToolsEnabled = false,
    additionalLocals = {}
} = {}) {
    const breakGlassLocals = buildBreakGlassLocals(runtimeConfig);
    const immutableLogging = runtimeConfig && runtimeConfig.immutableLogging ? runtimeConfig.immutableLogging : {};
    const transportSecurity = runtimeConfig && runtimeConfig.transport ? runtimeConfig.transport : {};

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
    app.locals.breakGlassStateStore = breakGlassStateStore || null;
    app.locals.runtimePosture = runtimeConfig && runtimeConfig.runtimePosture ? runtimeConfig.runtimePosture : {
        profile: 'local',
        protectedRuntime: false,
        source: 'default'
    };
    app.locals.identityLifecycle = runtimeConfig && runtimeConfig.identityLifecycle ? runtimeConfig.identityLifecycle : {
        protectedRuntime: false,
        selfSignupEnabled: true,
        googleAutoProvisionEnabled: true
    };
    app.locals.privilegedDevToolsEnabled = Boolean(privilegedDevToolsEnabled);

    Object.assign(app.locals, additionalLocals);

    return app;
}

module.exports = {
    applyApplicationLocals,
    buildBreakGlassLocals
};
