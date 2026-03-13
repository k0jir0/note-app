const { expect } = require('chai');

const {
    MIN_SESSION_SECRET_LENGTH,
    hasGoogleAuthCredentials,
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
});
