const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');

const devRuntimeRoute = require('./src/routes/devRuntimeRoutes');
const devSeedRoute = require('./src/routes/devSeedRoutes');
const { createApp } = require('./src/app/createApp');
const { validateRuntimeConfig } = require('./src/config/runtimeConfig');
const { loadRuntimeEnvironment, reapplyLocalEnvOverrides } = require('./src/config/runtimeEnv');
const { tryLoadKeytarGoogleSecrets } = require('./src/config/localSecrets');
const { createBreakGlassStateStore } = require('./src/services/breakGlassStateStoreService');
const { applyMongooseInjectionDefaults } = require('./src/services/injectionPreventionService');
const { startApplication } = require('./src/utils/appStartup');
const { createImmutableLogClient, installGlobalConsoleMirror } = require('./src/utils/immutableLogService');
const { configureDatabaseTelemetry } = require('./src/utils/databaseTelemetry');
const { createServerFactory } = require('./src/utils/serverTransport');
const { createPersistentAuditClient } = require('./src/services/persistentAuditService');

const { localEnvOverrides } = loadRuntimeEnvironment({ rootDir: __dirname });

(async function main() {
    try {
        const keyLoad = await tryLoadKeytarGoogleSecrets().catch((e) => ({ loaded: false, error: e }));
        if (!keyLoad.loaded && keyLoad.error) {
            console.warn('Keyring secrets not loaded (keytar missing or failed):', keyLoad.error && keyLoad.error.message ? keyLoad.error.message : keyLoad.error);
        }

        reapplyLocalEnvOverrides(localEnvOverrides);

        const runtimeConfig = validateRuntimeConfig();
        const mongooseSecurity = applyMongooseInjectionDefaults(mongoose);
        require('./src/config/passport')(passport, runtimeConfig);

        const immutableRemoteClient = createImmutableLogClient(runtimeConfig);
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

        const immutableLogClient = createPersistentAuditClient({
            baseClient: immutableRemoteClient,
            requireRemoteSuccess: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.requireForwardSuccess),
            throwOnRequiredFailure: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.requireForwardSuccess),
            onRequiredFailure: handleRequiredAuditFailure
        });
        installGlobalConsoleMirror(immutableLogClient);
        configureDatabaseTelemetry({ client: immutableLogClient });

        const isProduction = process.env.NODE_ENV === 'production';
        const useSecureCookies = isProduction || Boolean(runtimeConfig.transport && runtimeConfig.transport.httpsEnabled);
        const realtimeAvailable = Boolean(process.env.REDIS_URL) && process.env.DISABLE_REDIS !== '1';
        const privilegedDevToolsEnabled = !isProduction
            && String(process.env.ENABLE_PRIVILEGED_DEV_TOOLS || '').trim().toLowerCase() === 'true';
        const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24;
        const dbURI = runtimeConfig.dbURI;
        const breakGlassStateStore = createBreakGlassStateStore({
            seedState: runtimeConfig.breakGlass,
            strictPersistence: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.required)
        });

        const sessionStore = MongoStore.create({
            mongoUrl: dbURI,
            ttl: Math.floor(SESSION_COOKIE_MAX_AGE / 1000)
        });

        const sessionMiddleware = session({
            secret: runtimeConfig.sessionSecret,
            store: sessionStore,
            resave: false,
            saveUninitialized: false,
            cookie: {
                maxAge: SESSION_COOKIE_MAX_AGE,
                secure: useSecureCookies,
                httpOnly: true,
                sameSite: 'lax'
            }
        });

        const app = createApp({
            rootDir: __dirname,
            runtimeConfig,
            mongooseLib: mongoose,
            injectionPreventionPosture: mongooseSecurity,
            immutableLogClient,
            breakGlassStateStore,
            passportInstance: passport,
            sessionMiddleware,
            isProduction,
            appBaseUrl: runtimeConfig.appBaseUrl,
            realtimeAvailable,
            realtimeEnabled: realtimeAvailable && process.env.ENABLE_REALTIME === '1',
            privilegedDevToolsEnabled,
            registerAdditionalRoutes: (application) => {
                if (privilegedDevToolsEnabled) {
                    application.use(devSeedRoute);
                    application.use(devRuntimeRoute);
                }
            }
        });

        const PORT = process.env.PORT || 3000;
        const serverFactory = createServerFactory({
            transport: runtimeConfig.transport
        });

        await startApplication({
            app,
            mongooseLib: mongoose,
            dbURI,
            port: PORT,
            logger: console,
            serverFactory
        });
    } catch (error) {
        console.error(error && error.message ? error.message : error);
        process.exit(1);
    }
})();
