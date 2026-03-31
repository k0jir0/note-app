const path = require('path');

const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');

const devRuntimeRoute = require('../routes/devRuntimeRoutes');
const devSeedRoute = require('../routes/devSeedRoutes');
const { createApp } = require('./createApp');
const configurePassport = require('../config/passport');
const { validateRuntimeConfig } = require('../config/runtimeConfig');
const { loadRuntimeEnvironment, reapplyLocalEnvOverrides } = require('../config/runtimeEnv');
const { tryLoadKeytarGoogleSecrets } = require('../config/localSecrets');
const { createBreakGlassStateStore } = require('../services/breakGlassStateStoreService');
const { applyMongooseInjectionDefaults } = require('../services/injectionPreventionService');
const { startApplication } = require('../utils/appStartup');
const { createImmutableLogClient, installGlobalConsoleMirror } = require('../utils/immutableLogService');
const { configureDatabaseTelemetry } = require('../utils/databaseTelemetry');
const { createServerFactory } = require('../utils/serverTransport');
const { createPersistentAuditClient } = require('../services/persistentAuditService');

async function bootstrapApplication({
    rootDir = path.resolve(__dirname, '..', '..'),
    env = process.env,
    mongooseLib = mongoose,
    sessionLib = session,
    mongoStoreFactory = MongoStore,
    passportInstance = passport,
    createAppFn = createApp,
    configurePassportFn = configurePassport,
    validateRuntimeConfigFn = validateRuntimeConfig,
    loadRuntimeEnvironmentFn = loadRuntimeEnvironment,
    reapplyLocalEnvOverridesFn = reapplyLocalEnvOverrides,
    tryLoadKeytarGoogleSecretsFn = tryLoadKeytarGoogleSecrets,
    createBreakGlassStateStoreFn = createBreakGlassStateStore,
    applyMongooseInjectionDefaultsFn = applyMongooseInjectionDefaults,
    startApplicationFn = startApplication,
    createImmutableLogClientFn = createImmutableLogClient,
    installGlobalConsoleMirrorFn = installGlobalConsoleMirror,
    configureDatabaseTelemetryFn = configureDatabaseTelemetry,
    createServerFactoryFn = createServerFactory,
    createPersistentAuditClientFn = createPersistentAuditClient,
    logger = console
} = {}) {
    const { localEnvOverrides } = loadRuntimeEnvironmentFn({ rootDir });
    const keyLoad = await tryLoadKeytarGoogleSecretsFn().catch((error) => ({ loaded: false, error }));
    if (!keyLoad.loaded && keyLoad.error && logger && typeof logger.warn === 'function') {
        logger.warn(
            'Keyring secrets not loaded (keytar missing or failed):',
            keyLoad.error && keyLoad.error.message ? keyLoad.error.message : keyLoad.error
        );
    }

    reapplyLocalEnvOverridesFn(localEnvOverrides);

    const runtimeConfig = validateRuntimeConfigFn(env);
    const mongooseSecurity = applyMongooseInjectionDefaultsFn(mongooseLib);
    configurePassportFn(passportInstance, runtimeConfig);

    const immutableRemoteClient = createImmutableLogClientFn(runtimeConfig);
    let requiredAuditFailureTriggered = false;

    const handleRequiredAuditFailure = (error) => {
        if (requiredAuditFailureTriggered) {
            return;
        }

        requiredAuditFailureTriggered = true;
        const detail = error && error.message ? error.message : String(error);
        process.stderr.write(`[immutable-logging] required audit delivery failed: ${detail}\n`);
        setTimeout(() => process.exit(1), 0);
    };

    if (runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.requireForwardSuccess) {
        const auditSinkReady = await immutableRemoteClient.info('Immutable logging startup connectivity check', {
            category: 'startup',
            channel: 'startup',
            check: 'immutable-logging-connectivity'
        });

        if (!auditSinkReady) {
            throw new Error('Required immutable logging sink is unavailable at startup.');
        }
    }

    const immutableLogClient = createPersistentAuditClientFn({
        baseClient: immutableRemoteClient,
        requireRemoteSuccess: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.requireForwardSuccess),
        throwOnRequiredFailure: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.requireForwardSuccess),
        onRequiredFailure: handleRequiredAuditFailure
    });
    installGlobalConsoleMirrorFn(immutableLogClient);
    configureDatabaseTelemetryFn({ client: immutableLogClient });

    const protectedRuntime = Boolean(runtimeConfig.runtimePosture && runtimeConfig.runtimePosture.protectedRuntime);
    const isProduction = env.NODE_ENV === 'production';
    const useSecureCookies = protectedRuntime
        || Boolean(runtimeConfig.transport && (
            runtimeConfig.transport.httpsEnabled
            || runtimeConfig.transport.proxyTlsTerminated
            || runtimeConfig.transport.secureTransportRequired
        ));
    const realtimeAvailable = Boolean(env.REDIS_URL) && env.DISABLE_REDIS !== '1';
    const privilegedDevToolsEnabled = !protectedRuntime
        && String(env.ENABLE_PRIVILEGED_DEV_TOOLS || '').trim().toLowerCase() === 'true';
    const sessionCookieMaxAge = 1000 * 60 * 60 * 24;
    const dbURI = runtimeConfig.dbURI;
    const breakGlassStateStore = createBreakGlassStateStoreFn({
        seedState: runtimeConfig.breakGlass,
        strictPersistence: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.required)
    });

    const sessionStore = mongoStoreFactory.create({
        mongoUrl: dbURI,
        ttl: Math.floor(sessionCookieMaxAge / 1000)
    });

    const sessionMiddleware = sessionLib({
        secret: runtimeConfig.sessionSecret,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: sessionCookieMaxAge,
            secure: useSecureCookies,
            httpOnly: true,
            sameSite: 'lax'
        }
    });

    const app = createAppFn({
        rootDir,
        runtimeConfig,
        mongooseLib,
        injectionPreventionPosture: mongooseSecurity,
        immutableLogClient,
        breakGlassStateStore,
        passportInstance,
        sessionMiddleware,
        isProduction,
        appBaseUrl: runtimeConfig.appBaseUrl,
        realtimeAvailable,
        realtimeEnabled: realtimeAvailable && env.ENABLE_REALTIME === '1',
        privilegedDevToolsEnabled,
        registerAdditionalRoutes: (application) => {
            if (privilegedDevToolsEnabled) {
                application.use(devSeedRoute);
                application.use(devRuntimeRoute);
            }
        }
    });

    const port = env.PORT || 3000;
    const serverFactory = createServerFactoryFn({
        transport: runtimeConfig.transport
    });

    const server = await startApplicationFn({
        app,
        mongooseLib,
        dbURI,
        port,
        logger,
        serverFactory
    });

    return {
        app,
        server,
        runtimeConfig,
        sessionMiddleware,
        useSecureCookies,
        privilegedDevToolsEnabled
    };
}

module.exports = {
    bootstrapApplication
};
