const crypto = require('crypto');

const DEFAULT_CIPHER_ALGO = 'aes-256-gcm';
const LEGACY_ENCRYPTION_PREFIX = 'enc:v1';
const ENCRYPTION_PREFIX = 'enc:v2';

function normalizeCipherAlgo(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-');
}

function createAes256GcmSuite() {
    return {
        id: 'aes-256-gcm',
        keyLengthBytes: 32,
        ivLengthBytes: 12,
        authTagLengthBytes: 16,
        encrypt(plaintext, key) {
            const iv = crypto.randomBytes(this.ivLengthBytes);
            const cipher = crypto.createCipheriv(this.id, key, iv);
            const encrypted = Buffer.concat([
                cipher.update(plaintext, 'utf8'),
                cipher.final()
            ]);

            return {
                iv,
                authTag: cipher.getAuthTag(),
                ciphertext: encrypted
            };
        },
        decrypt({ iv, authTag, ciphertext }, key) {
            const decipher = crypto.createDecipheriv(this.id, key, iv);
            decipher.setAuthTag(authTag);
            return Buffer.concat([
                decipher.update(ciphertext),
                decipher.final()
            ]).toString('utf8');
        }
    };
}

const SUITES = new Map([
    ['aes-256-gcm', createAes256GcmSuite()]
]);

function listSupportedCipherAlgos() {
    return Array.from(SUITES.keys());
}

function getCryptoSuite(cipherAlgo = process.env.CIPHER_ALGO) {
    const normalized = normalizeCipherAlgo(cipherAlgo) || DEFAULT_CIPHER_ALGO;
    const suite = SUITES.get(normalized);
    if (!suite) {
        throw new Error(`Unsupported CIPHER_ALGO: ${cipherAlgo}`);
    }

    return suite;
}

function buildEncryptedPayload({ suite, plaintext, key }) {
    const encrypted = suite.encrypt(plaintext, key);
    return `${ENCRYPTION_PREFIX}:${suite.id}:${encrypted.iv.toString('base64')}:${encrypted.authTag.toString('base64')}:${encrypted.ciphertext.toString('base64')}`;
}

function parseEncryptedPayload(ciphertext) {
    const normalized = String(ciphertext || '');
    if (normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
        const payload = normalized.slice(`${ENCRYPTION_PREFIX}:`.length);
        const [suiteId, ivB64, authTagB64, encryptedB64] = payload.split(':');
        if (!suiteId || !ivB64 || !authTagB64 || !encryptedB64) {
            throw new Error('Invalid encrypted note payload format');
        }

        return {
            version: 2,
            suiteId,
            iv: Buffer.from(ivB64, 'base64'),
            authTag: Buffer.from(authTagB64, 'base64'),
            ciphertext: Buffer.from(encryptedB64, 'base64')
        };
    }

    if (normalized.startsWith(`${LEGACY_ENCRYPTION_PREFIX}:`)) {
        const payload = normalized.slice(`${LEGACY_ENCRYPTION_PREFIX}:`.length);
        const [ivB64, authTagB64, encryptedB64] = payload.split(':');
        if (!ivB64 || !authTagB64 || !encryptedB64) {
            throw new Error('Invalid encrypted note payload format');
        }

        return {
            version: 1,
            suiteId: DEFAULT_CIPHER_ALGO,
            iv: Buffer.from(ivB64, 'base64'),
            authTag: Buffer.from(authTagB64, 'base64'),
            ciphertext: Buffer.from(encryptedB64, 'base64')
        };
    }

    return null;
}

function decryptEncryptedPayload(ciphertext, key) {
    const payload = parseEncryptedPayload(ciphertext);
    if (!payload) {
        return ciphertext;
    }

    const suite = getCryptoSuite(payload.suiteId);
    return suite.decrypt(payload, key);
}

function isEncryptedPayload(value) {
    return typeof value === 'string'
        && (value.startsWith(`${ENCRYPTION_PREFIX}:`) || value.startsWith(`${LEGACY_ENCRYPTION_PREFIX}:`));
}

module.exports = {
    DEFAULT_CIPHER_ALGO,
    ENCRYPTION_PREFIX,
    LEGACY_ENCRYPTION_PREFIX,
    buildEncryptedPayload,
    decryptEncryptedPayload,
    getCryptoSuite,
    isEncryptedPayload,
    listSupportedCipherAlgos,
    normalizeCipherAlgo,
    parseEncryptedPayload
};
