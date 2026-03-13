const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'enc:v1';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

const ENCRYPTED_NOTE_FIELDS = ['title', 'content', 'image'];

let cachedKey = null;
let cachedRawKey = null;

function deriveKeyFromFallback(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

function parseConfiguredKey(rawKey) {
    const trimmedKey = rawKey.trim();

    if (/^[a-fA-F0-9]{64}$/.test(trimmedKey)) {
        return Buffer.from(trimmedKey, 'hex');
    }

    const base64Buffer = Buffer.from(trimmedKey, 'base64');
    if (base64Buffer.length === 32) {
        return base64Buffer;
    }

    throw new Error('NOTE_ENCRYPTION_KEY must be a 64-char hex string or base64 for 32 bytes');
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

    const fallbackSecret = process.env.SESSION_SECRET || '';
    if (!fallbackSecret.trim()) {
        throw new Error('Missing NOTE_ENCRYPTION_KEY (or SESSION_SECRET fallback) for note encryption');
    }

    cachedKey = deriveKeyFromFallback(fallbackSecret);
    cachedRawKey = rawConfiguredKey;
    return cachedKey;
}

function isEncryptedValue(value) {
    return typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

function encryptText(plaintext) {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
        return plaintext;
    }

    if (isEncryptedValue(plaintext)) {
        return plaintext;
    }

    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptText(ciphertext) {
    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
        return ciphertext;
    }

    if (!isEncryptedValue(ciphertext)) {
        return ciphertext;
    }

    const payload = ciphertext.slice(`${ENCRYPTION_PREFIX}:`.length);
    const [ivB64, authTagB64, encryptedB64] = payload.split(':');

    if (!ivB64 || !authTagB64 || !encryptedB64) {
        throw new Error('Invalid encrypted note payload format');
    }

    const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        getEncryptionKey(),
        Buffer.from(ivB64, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedB64, 'base64')),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
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

function decryptNoteDocumentFields(doc) {
    if (!doc) {
        return doc;
    }

    ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => {
        const currentValue = doc.get(fieldName);
        if (typeof currentValue === 'string' && currentValue.length > 0) {
            doc.set(fieldName, decryptText(currentValue));
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
