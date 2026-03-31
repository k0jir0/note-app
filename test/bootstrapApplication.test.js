const { expect } = require('chai');
const sinon = require('sinon');

const { bootstrapApplication } = require('../src/app/bootstrapApplication');

describe('bootstrap application', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('assembles protected runtime startup with secure cookies, strict audit forwarding, and pinned proxy trust', async () => {
        const env = {
            NODE_ENV: 'staging',
            APP_BASE_URL: 'https://note-app.example.gov',
            MONGODB_URI: 'mongodb://127.0.0.1:27017/noteAppProtectedCi?tls=true',
            SESSION_SECRET: 'ci-session-secret-0123456789abcdef',
            NOTE_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            TRUST_PROXY_HOPS: '1',
            TRUSTED_PROXY_ADDRESSES: '127.0.0.1',
            IMMUTABLE_LOGGING_ENABLED: 'true',
            IMMUTABLE_LOGGING_URL: 'https://logs.example.gov/append',
            IMMUTABLE_LOGGING_TOKEN: 'ci-log-token',
            SELF_SIGNUP_ENABLED: 'false',
            GOOGLE_AUTO_PROVISION_ENABLED: 'false'
        };
        const immutableRemoteClient = {
            info: sinon.stub().resolves(true)
        };
        const immutableLogClient = {
            info: sinon.stub().resolves(true)
        };
        const sessionStore = { kind: 'mongo-store' };
        const fakeApp = { kind: 'express-app' };
        const fakeServer = { kind: 'server' };
        const createAppFn = sinon.stub().returns(fakeApp);
        const configurePassportFn = sinon.stub();
        const createBreakGlassStateStoreFn = sinon.stub().returns({ kind: 'break-glass-store' });
        const applyMongooseInjectionDefaultsFn = sinon.stub().returns({
            requestGuardEnabled: true
        });
        const createImmutableLogClientFn = sinon.stub().returns(immutableRemoteClient);
        const createPersistentAuditClientFn = sinon.stub().returns(immutableLogClient);
        const installGlobalConsoleMirrorFn = sinon.stub();
        const configureDatabaseTelemetryFn = sinon.stub();
        const createServerFactoryFn = sinon.stub().returns('tls-factory');
        const startApplicationFn = sinon.stub().resolves(fakeServer);
        const sessionLib = sinon.stub().callsFake((options) => ({
            kind: 'session-middleware',
            options
        }));
        const mongoStoreFactory = {
            create: sinon.stub().returns(sessionStore)
        };

        const result = await bootstrapApplication({
            rootDir: process.cwd(),
            env,
            mongooseLib: { connect: sinon.stub().resolves() },
            passportInstance: { kind: 'passport-instance' },
            loadRuntimeEnvironmentFn: sinon.stub().returns({ localEnvOverrides: {} }),
            reapplyLocalEnvOverridesFn: sinon.stub(),
            tryLoadKeytarGoogleSecretsFn: sinon.stub().resolves({ loaded: true }),
            createAppFn,
            configurePassportFn,
            createBreakGlassStateStoreFn,
            applyMongooseInjectionDefaultsFn,
            createImmutableLogClientFn,
            createPersistentAuditClientFn,
            installGlobalConsoleMirrorFn,
            configureDatabaseTelemetryFn,
            createServerFactoryFn,
            startApplicationFn,
            sessionLib,
            mongoStoreFactory,
            logger: {
                warn: sinon.stub(),
                log: sinon.stub()
            }
        });

        expect(result.server).to.equal(fakeServer);
        expect(result.useSecureCookies).to.equal(true);
        expect(result.privilegedDevToolsEnabled).to.equal(false);
        expect(immutableRemoteClient.info.calledOnce).to.equal(true);
        expect(createPersistentAuditClientFn.calledOnce).to.equal(true);
        expect(createPersistentAuditClientFn.firstCall.args[0].requireRemoteSuccess).to.equal(true);
        expect(createPersistentAuditClientFn.firstCall.args[0].throwOnRequiredFailure).to.equal(true);
        expect(mongoStoreFactory.create.calledOnceWithExactly({
            mongoUrl: 'mongodb://127.0.0.1:27017/noteAppProtectedCi?tls=true',
            ttl: 60 * 60 * 24
        })).to.equal(true);
        expect(sessionLib.calledOnce).to.equal(true);
        expect(sessionLib.firstCall.args[0].cookie.secure).to.equal(true);
        expect(createServerFactoryFn.calledOnce).to.equal(true);
        expect(createServerFactoryFn.firstCall.args[0].transport.trustedProxyAddresses).to.deep.equal(['127.0.0.1']);
        expect(createAppFn.calledOnce).to.equal(true);
        expect(createAppFn.firstCall.args[0].runtimeConfig.transport.proxyTlsTerminated).to.equal(true);
        expect(createAppFn.firstCall.args[0].privilegedDevToolsEnabled).to.equal(false);
        expect(createAppFn.firstCall.args[0].sessionMiddleware.options.store).to.equal(sessionStore);
        expect(startApplicationFn.calledOnce).to.equal(true);
        expect(startApplicationFn.firstCall.args[0]).to.include({
            app: fakeApp,
            dbURI: 'mongodb://127.0.0.1:27017/noteAppProtectedCi?tls=true',
            port: 3000,
            serverFactory: 'tls-factory'
        });
        expect(configurePassportFn.calledOnce).to.equal(true);
        expect(installGlobalConsoleMirrorFn.calledOnceWithExactly(immutableLogClient)).to.equal(true);
        expect(configureDatabaseTelemetryFn.calledOnceWithExactly({ client: immutableLogClient })).to.equal(true);
    });
});
