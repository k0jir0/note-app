const { expect } = require('chai');

const { resolveBackupProtection } = require('../src/services/backupProtectionService');

describe('backup protection service', () => {
    const runtimeConfig = {
        cipherAlgo: 'aes-256-gcm',
        noteEncryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    };

    it('requires a dedicated backup encryption key', () => {
        expect(() => resolveBackupProtection({
            env: {},
            runtimeConfig
        })).to.throw('BACKUP_ENCRYPTION_KEY is required');
    });

    it('rejects reuse of the live note encryption key for backup archives', () => {
        expect(() => resolveBackupProtection({
            env: {
                BACKUP_ENCRYPTION_KEY: runtimeConfig.noteEncryptionKey
            },
            runtimeConfig
        })).to.throw('BACKUP_ENCRYPTION_KEY must be distinct from NOTE_ENCRYPTION_KEY');
    });

    it('returns a validated dedicated backup protection secret', () => {
        const protection = resolveBackupProtection({
            env: {
                BACKUP_ENCRYPTION_KEY: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
            },
            runtimeConfig
        });

        expect(protection).to.deep.equal({
            rawSecret: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            cipherAlgo: 'aes-256-gcm'
        });
    });
});
