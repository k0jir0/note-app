const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');

const devRuntimeRoute = require('./src/routes/devRuntimeRoutes');
const { createApp } = require('./src/app/createApp');
const { validateRuntimeConfig } = require('./src/config/runtimeConfig');
const { loadRuntimeEnvironment, reapplyLocalEnvOverrides } = require('./src/config/runtimeEnv');
const { destructiveActionRateLimiter } = require('./src/middleware/rateLimit');
const { tryLoadKeytarGoogleSecrets } = require('./src/config/localSecrets');
const { buildSeedResponseMessage, seedDevelopmentData } = require('./src/services/devSeedService');
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
        require('./src/config/passport')(passport);

        const immutableRemoteClient = createImmutableLogClient(runtimeConfig);
        const immutableLogClient = createPersistentAuditClient({ baseClient: immutableRemoteClient });
        installGlobalConsoleMirror(immutableLogClient);
        configureDatabaseTelemetry({ client: immutableLogClient });

        const isProduction = process.env.NODE_ENV === 'production';
        const useSecureCookies = isProduction || Boolean(runtimeConfig.transport && runtimeConfig.transport.httpsEnabled);
        const realtimeAvailable = Boolean(process.env.REDIS_URL) && process.env.DISABLE_REDIS !== '1';
        const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24;
        const dbURI = runtimeConfig.dbURI;

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
            passportInstance: passport,
            sessionMiddleware,
            isProduction,
            appBaseUrl: runtimeConfig.appBaseUrl,
            realtimeAvailable,
            realtimeEnabled: realtimeAvailable && process.env.ENABLE_REALTIME === '1',
            registerAdditionalRoutes: (application) => {
                if (process.env.NODE_ENV !== 'production') {
                    const { requireAuth } = require('./src/middleware/auth');

                    application.post('/seed', requireAuth, destructiveActionRateLimiter, async (req, res) => {
                        const User = require('./src/models/User');
                        const Notes = require('./src/models/Notes');
                        const bcrypt = require('bcrypt');

                        try {
                            const seedSummary = await seedDevelopmentData({
                                User,
                                Notes,
                                bcryptLib: bcrypt
                            });

                            res.type('text/plain').send(buildSeedResponseMessage(seedSummary));
                        } catch (error) {
                            console.error('Development seed failed:', error);
                            res.status(500).send('Database seeding failed. Please try again later.');
                        }
                    });

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
