const { expect } = require('chai');

const {
    MIN_SESSION_SECRET_LENGTH,
    getConfiguredAppBaseUrl,
    hasGoogleAuthCredentials,
    toDiagnosticRuntimeConfig,
    validateRuntimeConfig
} = require('../src/config/runtimeConfig');

describe('Runtime Config Validation', () => {
    function createValidEnv() {
        return {
            MONGODB_URI: 'mongodb://localhost:27017/noteApp',
            SESSION_SECRET: 'a'.repeat(MIN_SESSION_SECRET_LENGTH),
            NOTE_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        };
    }

    it('accepts a valid config without Google OAuth', () => {
        const config = validateRuntimeConfig(createValidEnv());

        expect(config.dbURI).to.equal('mongodb://localhost:27017/noteApp');
        expect(config.googleAuthEnabled).to.equal(false);
    });

    it('rejects weak or placeholder secrets', () => {
        const env = createValidEnv();
        env.SESSION_SECRET = 'YourSecretKeyHere';

        expect(() => validateRuntimeConfig(env)).to.throw('SESSION_SECRET');
    });

    it('rejects missing note encryption key', () => {
        const env = createValidEnv();
        delete env.NOTE_ENCRYPTION_KEY;

        expect(() => validateRuntimeConfig(env)).to.throw('NOTE_ENCRYPTION_KEY is required');
    });

    it('requires Google OAuth credentials to be provided together', () => {
        const env = createValidEnv();
        env.GOOGLE_CLIENT_ID = 'client-id-only';

        expect(() => validateRuntimeConfig(env)).to.throw('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided together');
    });

    it('detects when Google OAuth is configured', () => {
        const env = createValidEnv();
        env.GOOGLE_CLIENT_ID = 'google-client-id';
        env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        expect(hasGoogleAuthCredentials(env)).to.equal(true);
        expect(validateRuntimeConfig(env).googleAuthEnabled).to.equal(true);
    });

    it('accepts a valid APP_BASE_URL and exposes it in config', () => {
        const env = createValidEnv();
        env.APP_BASE_URL = 'http://localhost:3000/';

        const config = validateRuntimeConfig(env);

        expect(config.appBaseUrl).to.equal('http://localhost:3000');
        expect(getConfiguredAppBaseUrl(env)).to.equal('http://localhost:3000');
    });

    it('rejects an invalid APP_BASE_URL', () => {
        const env = createValidEnv();
        env.APP_BASE_URL = 'not-a-url';

        expect(() => validateRuntimeConfig(env)).to.throw('APP_BASE_URL must be a valid http or https URL when set');
    });

    it('returns disabled automation config by default', () => {
        const config = validateRuntimeConfig(createValidEnv());

        expect(config.automation.logBatch.enabled).to.equal(false);
        expect(config.automation.scanBatch.enabled).to.equal(false);
        expect(config.transport).to.deep.equal({
            protocol: 'http',
            httpsEnabled: false,
            requestClientCertificate: false,
            requireClientCertificate: false,
            trustProxyClientCertHeaders: false,
            keyPath: '',
            certPath: '',
            caPath: ''
        });
    });

    it('accepts valid HTTPS and mTLS transport settings', () => {
        const env = createValidEnv();
        env.HTTPS_ENABLED = 'true';
        env.HTTPS_KEY_PATH = 'C:\\tls\\server.key';
        env.HTTPS_CERT_PATH = 'C:\\tls\\server.crt';
        env.HTTPS_REQUEST_CLIENT_CERT = 'true';
        env.HTTPS_REQUIRE_CLIENT_CERT = 'true';
        env.HTTPS_CA_PATH = 'C:\\tls\\ca.crt';

        const config = validateRuntimeConfig(env);

        expect(config.transport).to.deep.equal({
            protocol: 'https',
            httpsEnabled: true,
            requestClientCertificate: true,
            requireClientCertificate: true,
            trustProxyClientCertHeaders: false,
            keyPath: 'C:\\tls\\server.key',
            certPath: 'C:\\tls\\server.crt',
            caPath: 'C:\\tls\\ca.crt'
        });
    });

    it('rejects invalid HTTPS and mTLS transport combinations', () => {
        const env = createValidEnv();
        env.HTTPS_REQUEST_CLIENT_CERT = 'true';

        expect(() => validateRuntimeConfig(env)).to.throw('HTTPS_REQUEST_CLIENT_CERT and HTTPS_REQUIRE_CLIENT_CERT require HTTPS_ENABLED=true');

        env.HTTPS_ENABLED = 'true';
        env.HTTPS_KEY_PATH = 'C:\\tls\\server.key';
        env.HTTPS_CERT_PATH = 'C:\\tls\\server.crt';

        expect(() => validateRuntimeConfig(env)).to.throw('HTTPS_CA_PATH is required when HTTPS_REQUEST_CLIENT_CERT=true');
    });

    it('requires file path and user id when log batch automation is enabled', () => {
        const env = createValidEnv();
        env.LOG_BATCH_ENABLED = 'true';

        expect(() => validateRuntimeConfig(env)).to.throw('LOG_BATCH_FILE_PATH');
        expect(() => validateRuntimeConfig(env)).to.throw('LOG_BATCH_USER_ID');
    });

    it('accepts valid log and scan automation settings', () => {
        const env = createValidEnv();
        env.LOG_BATCH_ENABLED = 'true';
        env.LOG_BATCH_FILE_PATH = 'C:\\logs\\app.log';
        env.LOG_BATCH_USER_ID = '507f1f77bcf86cd799439011';
        env.SCAN_BATCH_ENABLED = 'true';
        env.SCAN_BATCH_FILE_PATH = 'C:\\scans\\latest.xml';
        env.SCAN_BATCH_USER_ID = '507f191e810c19729de860ea';

        const config = validateRuntimeConfig(env);

        expect(config.automation.logBatch.enabled).to.equal(true);
        expect(config.automation.logBatch.filePath).to.equal('C:\\logs\\app.log');
        expect(config.automation.scanBatch.enabled).to.equal(true);
        expect(config.automation.scanBatch.filePath).to.equal('C:\\scans\\latest.xml');
    });

    it('rejects invalid automation boolean and user id values', () => {
        const env = createValidEnv();
        env.LOG_BATCH_ENABLED = 'maybe';
        env.SCAN_BATCH_ENABLED = 'true';
        env.SCAN_BATCH_FILE_PATH = 'C:\\scans\\latest.xml';
        env.SCAN_BATCH_USER_ID = 'not-an-object-id';

        expect(() => validateRuntimeConfig(env)).to.throw('LOG_BATCH_ENABLED');
        expect(() => validateRuntimeConfig(env)).to.throw('SCAN_BATCH_USER_ID');
    });

    it('builds a sanitized runtime diagnostic view without secrets', () => {
        const diagnostics = toDiagnosticRuntimeConfig({
            dbURI: 'mongodb://localhost:27017/noteApp',
            sessionSecret: 'super-secret-value',
            noteEncryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            appBaseUrl: 'http://localhost:3000',
            googleAuthEnabled: true,
            transport: {
                httpsEnabled: true,
                requestClientCertificate: true,
                requireClientCertificate: false,
                trustProxyClientCertHeaders: true
            },
            automation: {
                logBatch: {
                    enabled: true,
                    filePath: 'C:\\logs\\app.log',
                    userId: '507f1f77bcf86cd799439011',
                    source: 'server-log-batch',
                    intervalMs: 60000,
                    dedupeWindowMs: 300000,
                    maxReadBytes: 65536
                }
            }
        });

        expect(diagnostics).to.include({
            dbConfigured: true,
            sessionSecretConfigured: true,
            noteEncryptionConfigured: true,
            appBaseUrl: 'http://localhost:3000',
            googleAuthEnabled: true
        });
        expect(diagnostics.transport).to.deep.equal({
            protocol: 'https',
            httpsEnabled: true,
            requestClientCertificate: true,
            requireClientCertificate: false,
            trustProxyClientCertHeaders: true
        });
        expect(diagnostics).to.not.have.property('dbURI');
        expect(diagnostics).to.not.have.property('sessionSecret');
        expect(diagnostics).to.not.have.property('noteEncryptionKey');
        expect(diagnostics.automation.logBatch).to.deep.equal({
            enabled: true,
            source: 'server-log-batch',
            intervalMs: 60000,
            dedupeWindowMs: 300000,
            maxReadBytes: 65536,
            fileConfigured: true,
            userConfigured: true
        });
        expect(diagnostics.automation.scanBatch.enabled).to.equal(false);
        expect(diagnostics.automation.intrusionBatch.enabled).to.equal(false);
    });
});
