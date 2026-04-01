const crypto = require('crypto');

const {
    buildEncryptedPayload,
    decryptEncryptedPayload,
    getCryptoSuite,
    isEncryptedPayload
} = require('./cryptoSuite');

const ENCRYPTED_NOTE_FIELDS = ['title', 'content', 'image'];

let cachedKey = null;
let cachedRawKey = null;

function deriveKeyFromFallback(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

function parseConfiguredKey(rawKey) {
    const trimmedKey = rawKey.trim();
    const { keyLengthBytes } = getCryptoSuite();

    if (/^[a-fA-F0-9]{64}$/.test(trimmedKey)) {
        const hexBuffer = Buffer.from(trimmedKey, 'hex');
        if (hexBuffer.length === keyLengthBytes) {
            return hexBuffer;
        }
    }

    const base64Buffer = Buffer.from(trimmedKey, 'base64');
    if (base64Buffer.length === keyLengthBytes) {
        return base64Buffer;
    }

    throw new Error(`NOTE_ENCRYPTION_KEY must be a ${keyLengthBytes * 2}-character hex string or base64 for ${keyLengthBytes} bytes`);
}

function getEncryptionKey() {
    const rawConfiguredKey = process.env.NOTE_ENCRYPTION_KEY || '';

    if (cachedKey && cachedRawKey === rawConfiguredKey) {
        return cachedKey;
    }

    if (rawConfiguredKey.trim()) {
        cachedKey = parseConfiguredKey(rawConfiguredKey);
        cachedRawKey = rawConfiguredKey;
        return cachedKey;
    }

    throw new Error('Missing NOTE_ENCRYPTION_KEY for note encryption');
}

function getLegacyDecryptionKeys() {
    const legacyKeys = [];
    const rawLegacyKey = process.env.LEGACY_NOTE_ENCRYPTION_KEY || '';

    if (rawLegacyKey.trim()) {
        legacyKeys.push(parseConfiguredKey(rawLegacyKey));
    }

    if (String(process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK || '').trim().toLowerCase() === 'true') {
        const fallbackSecret = process.env.SESSION_SECRET || '';
        if (fallbackSecret.trim()) {
            legacyKeys.push(deriveKeyFromFallback(fallbackSecret));
        }
    }

    return legacyKeys;
}

function decryptTextWithKey(ciphertext, key) {
    return decryptEncryptedPayload(ciphertext, key);
}

function isEncryptedValue(value) {
    return isEncryptedPayload(value);
}

function encryptText(plaintext) {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
        return plaintext;
    }

    if (isEncryptedValue(plaintext)) {
        return plaintext;
    }

    return buildEncryptedPayload({
        suite: getCryptoSuite(),
        plaintext,
        key: getEncryptionKey()
    });
}

function decryptText(ciphertext) {
    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
        return ciphertext;
    }

    if (!isEncryptedValue(ciphertext)) {
        return ciphertext;
    }

    const candidateKeys = [getEncryptionKey(), ...getLegacyDecryptionKeys()];
    let lastError = null;

    for (const key of candidateKeys) {
        try {
            return decryptTextWithKey(ciphertext, key);
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error('Unable to decrypt note payload with configured keys');
}

function encryptFieldInObject(container, fieldName) {
    if (!container || typeof container[fieldName] !== 'string') {
        return;
    }

    container[fieldName] = encryptText(container[fieldName]);
}

function encryptNoteUpdatePayload(update) {
    if (!update || typeof update !== 'object') {
        return update;
    }

    ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => encryptFieldInObject(update, fieldName));

    if (update.$set && typeof update.$set === 'object') {
        ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => encryptFieldInObject(update.$set, fieldName));
    }

    return update;
}

function readDocumentField(target, fieldName) {
    if (!target) {
        return undefined;
    }

    if (typeof target.get === 'function') {
        return target.get(fieldName);
    }

    return target[fieldName];
}

function writeDocumentField(target, fieldName, value) {
    if (!target) {
        return;
    }

    if (typeof target.set === 'function') {
        target.set(fieldName, value);
        return;
    }

    target[fieldName] = value;
}

function decryptNoteDocumentFields(doc) {
    if (!doc) {
        return doc;
    }

    ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => {
        const currentValue = readDocumentField(doc, fieldName);
        if (typeof currentValue === 'string' && currentValue.length > 0) {
            writeDocumentField(doc, fieldName, decryptText(currentValue));
        }
    });

    return doc;
}

module.exports = {
    ENCRYPTED_NOTE_FIELDS,
    isEncryptedValue,
    encryptText,
    decryptText,
    encryptNoteUpdatePayload,
    decryptNoteDocumentFields
};
