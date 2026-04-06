const fs = require('fs');
const os = require('os');
const path = require('path');

const { expect } = require('chai');

const {
    captureProtectedEnvKeys,
    loadRuntimeEnvironment,
    reapplyLocalEnvOverrides
} = require('../src/config/runtimeEnv');

describe('runtime environment loading', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('lets .env.local override .env without clobbering explicit process values', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-runtime-env-'));

        fs.writeFileSync(path.join(tempDirectory, '.env'), [
            'NODE_ENV=production',
            'APP_BASE_URL=http://env.example.com',
            'SESSION_SECRET=env-secret'
        ].join('\n'));
        fs.writeFileSync(path.join(tempDirectory, '.env.local'), [
            'NODE_ENV=development',
            'APP_BASE_URL=http://local.example.com',
            'SESSION_SECRET=local-secret'
        ].join('\n'));

        process.env = {
            ...originalEnv,
            NODE_ENV: 'test'
        };
        delete process.env.APP_BASE_URL;
        delete process.env.SESSION_SECRET;

        const protectedEnvKeys = captureProtectedEnvKeys();
        const { localEnvOverrides } = loadRuntimeEnvironment({
            rootDir: tempDirectory,
            protectedEnvKeys
        });

        expect(process.env.NODE_ENV).to.equal('test');
        expect(process.env.APP_BASE_URL).to.equal('http://local.example.com');
        expect(process.env.SESSION_SECRET).to.equal('local-secret');

        process.env.SESSION_SECRET = 'keytar-secret';
        reapplyLocalEnvOverrides(localEnvOverrides, protectedEnvKeys);

        expect(process.env.NODE_ENV).to.equal('test');
        expect(process.env.SESSION_SECRET).to.equal('local-secret');
    });
});
