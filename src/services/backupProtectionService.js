const {
    getActiveCipherSuite,
    validateEncryptionKeyFormat
} = require('../config/runtime/helpers');

function resolveBackupProtection({ env = process.env, runtimeConfig = {} } = {}) {
    const errors = [];
    const rawSecret = String(env.BACKUP_ENCRYPTION_KEY || '').trim();
    const noteEncryptionKey = String(runtimeConfig.noteEncryptionKey || '').trim();
    const cipherAlgo = runtimeConfig.cipherAlgo || 'aes-256-gcm';
    const suite = getActiveCipherSuite(cipherAlgo);

    if (!rawSecret) {
        errors.push('BACKUP_ENCRYPTION_KEY is required for backup export and restore operations.');
    } else {
        validateEncryptionKeyFormat('BACKUP_ENCRYPTION_KEY', rawSecret, suite, errors);
    }

    if (rawSecret && noteEncryptionKey && rawSecret === noteEncryptionKey) {
        errors.push('BACKUP_ENCRYPTION_KEY must be distinct from NOTE_ENCRYPTION_KEY.');
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return {
        rawSecret,
        cipherAlgo
    };
}

module.exports = {
    resolveBackupProtection
};
