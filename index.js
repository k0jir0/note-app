const path = require('path');

const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');

const noteApiRoute = require('./src/routes/noteApiRoutes');
const notePageRoute = require('./src/routes/notePageRoutes');
const securityApiRoute = require('./src/routes/securityApiRoutes');
const securityPageRoute = require('./src/routes/securityPageRoutes');
const mlApiRoute = require('./src/routes/mlApiRoutes');
const mlPageRoute = require('./src/routes/mlPageRoutes');
const playwrightApiRoute = require('./src/routes/playwrightApiRoutes');
const playwrightPageRoute = require('./src/routes/playwrightPageRoutes');
const locatorRepairApiRoute = require('./src/routes/locatorRepairApiRoutes');
const locatorRepairPageRoute = require('./src/routes/locatorRepairPageRoutes');
const xssDefenseApiRoute = require('./src/routes/xssDefenseApiRoutes');
const xssDefensePageRoute = require('./src/routes/xssDefensePageRoutes');
const breakGlassApiRoute = require('./src/routes/breakGlassApiRoutes');
const breakGlassPageRoute = require('./src/routes/breakGlassPageRoutes');
const accessControlApiRoute = require('./src/routes/accessControlApiRoutes');
const accessControlPageRoute = require('./src/routes/accessControlPageRoutes');
const hardwareFirstMfaApiRoute = require('./src/routes/hardwareFirstMfaApiRoutes');
const hardwareFirstMfaPageRoute = require('./src/routes/hardwareFirstMfaPageRoutes');
const missionAssuranceApiRoute = require('./src/routes/missionAssuranceApiRoutes');
const missionAssurancePageRoute = require('./src/routes/missionAssurancePageRoutes');
const sessionManagementApiRoute = require('./src/routes/sessionManagementApiRoutes');
const sessionManagementPageRoute = require('./src/routes/sessionManagementPageRoutes');
const seleniumApiRoute = require('./src/routes/seleniumApiRoutes');
const seleniumPageRoute = require('./src/routes/seleniumPageRoutes');
const scanApiRoute = require('./src/routes/scanApiRoutes');
const scanPageRoute = require('./src/routes/scanPageRoutes');
const supplyChainPageRoute = require('./src/routes/supplyChainPageRoutes');
const auditTelemetryPageRoute = require('./src/routes/auditTelemetryPageRoutes');
const auditTelemetryApiRoute = require('./src/routes/auditTelemetryApiRoutes');
const devRuntimeRoute = require('./src/routes/devRuntimeRoutes');
const authRoutes = require('./src/routes/authRoutes');
const settingsApiRoute = require('./src/routes/settingsApiRoutes');
const metricsRoute = require('./src/routes/metrics');
const breakGlassRoute = require('./src/routes/breakGlassRoutes');
const { validateRuntimeConfig } = require('./src/config/runtimeConfig');
const { loadRuntimeEnvironment, reapplyLocalEnvOverrides } = require('./src/config/runtimeEnv');
const { buildContentSecurityPolicyDirectives, buildHelmetProtectionOptions } = require('./src/config/xssDefense');
const { requireAuth } = require('./src/middleware/auth');
const { attachBreakGlassState, enforceBreakGlass } = require('./src/middleware/breakGlass');
const { ensureCsrfToken, requireCsrfProtection } = require('./src/middleware/csrf');
const { attachSessionAuthAssurance } = require('./src/middleware/sessionAuthAssurance');
const { enforceServerSideApiAccessControl } = require('./src/middleware/apiAccessControl');
const { enforceInjectionPrevention } = require('./src/middleware/injectionPrevention');
const { enforceStrictSessionManagement } = require('./src/middleware/sessionManagement');
const { destructiveActionRateLimiter } = require('./src/middleware/rateLimit');
const { sanitizeResponseMetadata } = require('./src/middleware/responseMetadataProtection');
const { tryLoadKeytarGoogleSecrets } = require('./src/config/localSecrets');
const { buildSeedResponseMessage, seedDevelopmentData } = require('./src/services/devSeedService');
const injectionPreventionApiRoute = require('./src/routes/injectionPreventionApiRoutes');
const injectionPreventionPageRoute = require('./src/routes/injectionPreventionPageRoutes');
const { applyMongooseInjectionDefaults } = require('./src/services/injectionPreventionService');
const { startApplication } = require('./src/utils/appStartup');
const { handleUnhandledError } = require('./src/utils/errorHandler');
const { createImmutableRequestAuditMiddleware } = require('./src/middleware/immutableRequestAudit');
const { createImmutableLogClient, installGlobalConsoleMirror } = require('./src/utils/immutableLogService');
const { requestContextMiddleware } = require('./src/utils/requestContext');
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
        // Apply local-only overrides last so localhost auth uses `.env.local`
        // even when shared env files or the system keyring are also configured.
        reapplyLocalEnvOverrides(localEnvOverrides);

        const runtimeConfig = validateRuntimeConfig();
        const mongooseSecurity = applyMongooseInjectionDefaults(mongoose);
        require('./src/config/passport')(passport);
        const app = express();
        const immutableRemoteClient = createImmutableLogClient(runtimeConfig);
        const immutableLogClient = createPersistentAuditClient({ baseClient: immutableRemoteClient });
        installGlobalConsoleMirror(immutableLogClient);
        configureDatabaseTelemetry({ client: immutableLogClient });
        const isProduction = process.env.NODE_ENV === 'production';
        const useSecureCookies = isProduction || Boolean(runtimeConfig.transport && runtimeConfig.transport.httpsEnabled);
        const realtimeAvailable = Boolean(process.env.REDIS_URL) && process.env.DISABLE_REDIS !== '1';

        app.disable('x-powered-by');
        app.locals.runtimeConfig = runtimeConfig;
        app.locals.appBaseUrl = runtimeConfig.appBaseUrl;
        app.locals.realtimeAvailable = realtimeAvailable;
        app.locals.mongooseLib = mongoose;
        app.locals.injectionPrevention = {
            requestGuardEnabled: true,
            ...mongooseSecurity
        };
        app.locals.xssDefense = {
            escapedServerRendering: true,
            strictCspEnabled: true,
            directives: buildContentSecurityPolicyDirectives()
        };
        // runtime toggle for realtime (can be changed without restarting when Redis is configured)
        app.locals.realtimeEnabled = realtimeAvailable && process.env.ENABLE_REALTIME === '1';
        app.locals.transportSecurity = runtimeConfig.transport;
        app.locals.immutableLogging = runtimeConfig.immutableLogging;
        app.locals.immutableLogClient = immutableLogClient;
        app.locals.breakGlass = {
            mode: runtimeConfig.breakGlass.mode,
            enabled: runtimeConfig.breakGlass.mode !== 'disabled',
            readOnly: runtimeConfig.breakGlass.mode === 'read_only',
            offline: runtimeConfig.breakGlass.mode === 'offline',
            reason: runtimeConfig.breakGlass.reason,
            activatedAt: runtimeConfig.breakGlass.mode === 'disabled' ? null : new Date().toISOString(),
            activatedBy: runtimeConfig.breakGlass.mode === 'disabled' ? '' : 'environment'
        };

        const trustProxyHops = runtimeConfig.transport && Number.isInteger(runtimeConfig.transport.trustProxyHops)
            ? runtimeConfig.transport.trustProxyHops
            : 0;
        if (trustProxyHops > 0 || (runtimeConfig.transport && runtimeConfig.transport.trustProxyClientCertHeaders)) {
            app.set('trust proxy', Math.max(trustProxyHops, 1));
        }

        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'src', 'views'));

        app.use(sanitizeResponseMetadata);
        app.use(helmet(buildHelmetProtectionOptions({ isProduction })));
        app.use(requestContextMiddleware);

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(enforceInjectionPrevention);
        app.use(createImmutableRequestAuditMiddleware({ client: immutableLogClient }));
        app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
        app.use('/vendor/bootstrap-icons', express.static(path.join(__dirname, 'node_modules', 'bootstrap-icons')));
        app.use(express.static(path.join(__dirname, 'src', 'views', 'public')));

        // Public fallback image for notes without an image URL.
        app.get('/placeholder.jpg', (req, res) => {
            res.sendFile(path.join(__dirname, 'src', 'image', 'placeholder.jpg'));
        });

        // Session configuration
        const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours in milliseconds

        const dbURI = runtimeConfig.dbURI;
        const sessionSecret = runtimeConfig.sessionSecret;
        const sessionStore = MongoStore.create({
            mongoUrl: dbURI,
            ttl: Math.floor(SESSION_COOKIE_MAX_AGE / 1000)
        });

        app.use(session({
            secret: sessionSecret,
            store: sessionStore,
            resave: false,
            saveUninitialized: false,
            cookie: {
                maxAge: SESSION_COOKIE_MAX_AGE,
                secure: useSecureCookies,
                httpOnly: true, // Prevents client-side JavaScript access
                sameSite: 'lax' // CSRF protection
            }
        }));

        // Passport middleware (must come after session)
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(enforceStrictSessionManagement);
        app.use(attachSessionAuthAssurance);
        app.use(enforceServerSideApiAccessControl);

        app.use(ensureCsrfToken);
        app.use(requireCsrfProtection);

        // Make user available in all views
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

        app.use(breakGlassRoute);

        // Authentication routes (must be before requireAuth middleware)
        app.use('/auth', authRoutes);

        // Settings API (persist user preferences)
        app.use(settingsApiRoute);

        // Metrics endpoint (Prometheus)
        app.use(metricsRoute.router);

        // Redirect home to notes page
        app.get('/', requireAuth, (req, res) => {
            res.redirect('/notes');
        });

        // Seed route - DEVELOPMENT ONLY - requires authentication
        // WARNING: This route deletes all data! Only enabled in non-production environments.
        if (process.env.NODE_ENV !== 'production') {
            app.post('/seed', requireAuth, destructiveActionRateLimiter, async (req, res) => {
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
        }

        app.use(noteApiRoute);
        app.use(notePageRoute);
        app.use(securityApiRoute);
        app.use(securityPageRoute);
        app.use(mlApiRoute);
        app.use(mlPageRoute);
        app.use(playwrightApiRoute);
        app.use(playwrightPageRoute);
        app.use(injectionPreventionApiRoute);
        app.use(injectionPreventionPageRoute);
        app.use(xssDefenseApiRoute);
        app.use(xssDefensePageRoute);
        app.use(breakGlassApiRoute);
        app.use(breakGlassPageRoute);
        app.use(accessControlApiRoute);
        app.use(accessControlPageRoute);
        app.use(locatorRepairApiRoute);
        app.use(locatorRepairPageRoute);
        app.use(hardwareFirstMfaApiRoute);
        app.use(hardwareFirstMfaPageRoute);
        app.use(missionAssuranceApiRoute);
        app.use(missionAssurancePageRoute);
        app.use(sessionManagementApiRoute);
        app.use(sessionManagementPageRoute);
        app.use(seleniumApiRoute);
        app.use(seleniumPageRoute);
        app.use(scanApiRoute);
        app.use(scanPageRoute);
        app.use(auditTelemetryApiRoute);
        app.use(supplyChainPageRoute);
        app.use(auditTelemetryPageRoute);

        if (process.env.NODE_ENV !== 'production') {
            app.use(devRuntimeRoute);
        }

        app.use(handleUnhandledError);

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

