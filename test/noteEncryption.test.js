const { expect } = require('chai');
const crypto = require('crypto');

const {
    isEncryptedValue,
    encryptText,
    decryptText,
    encryptNoteUpdatePayload
} = require('../src/utils/noteEncryption');

describe('Note Encryption Utility', () => {
    const originalNoteKey = process.env.NOTE_ENCRYPTION_KEY;
    const originalLegacyNoteKey = process.env.LEGACY_NOTE_ENCRYPTION_KEY;
    const originalSessionSecret = process.env.SESSION_SECRET;
    const originalLegacyFallbackFlag = process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK;

    before(() => {
        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    after(() => {
        if (originalNoteKey === undefined) {
            delete process.env.NOTE_ENCRYPTION_KEY;
        } else {
            process.env.NOTE_ENCRYPTION_KEY = originalNoteKey;
        }

        if (originalLegacyNoteKey === undefined) {
            delete process.env.LEGACY_NOTE_ENCRYPTION_KEY;
        } else {
            process.env.LEGACY_NOTE_ENCRYPTION_KEY = originalLegacyNoteKey;
        }

        if (originalSessionSecret === undefined) {
            delete process.env.SESSION_SECRET;
        } else {
            process.env.SESSION_SECRET = originalSessionSecret;
        }

        if (originalLegacyFallbackFlag === undefined) {
            delete process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK;
        } else {
            process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK = originalLegacyFallbackFlag;
        }
    });

    it('encrypts and decrypts plain text consistently', () => {
        const plaintext = 'My secret note content';

        const ciphertext = encryptText(plaintext);

        expect(ciphertext).to.not.equal(plaintext);
        expect(isEncryptedValue(ciphertext)).to.equal(true);
        expect(decryptText(ciphertext)).to.equal(plaintext);
    });

    it('does not double-encrypt an already encrypted value', () => {
        const ciphertext = encryptText('Already encrypted once');

        const encryptedAgain = encryptText(ciphertext);

        expect(encryptedAgain).to.equal(ciphertext);
    });

    it('encrypts direct and $set update payload fields', () => {
        const payload = {
            title: 'Top secret title',
            $set: {
                content: 'Top secret content',
                image: 'https://example.com/image.jpg'
            }
        };

        const encryptedPayload = encryptNoteUpdatePayload(payload);

        expect(isEncryptedValue(encryptedPayload.title)).to.equal(true);
        expect(isEncryptedValue(encryptedPayload.$set.content)).to.equal(true);
        expect(isEncryptedValue(encryptedPayload.$set.image)).to.equal(true);

        expect(decryptText(encryptedPayload.title)).to.equal('Top secret title');
        expect(decryptText(encryptedPayload.$set.content)).to.equal('Top secret content');
        expect(decryptText(encryptedPayload.$set.image)).to.equal('https://example.com/image.jpg');
    });

    it('throws when NOTE_ENCRYPTION_KEY is missing', () => {
        delete process.env.NOTE_ENCRYPTION_KEY;

        expect(() => encryptText('Missing key')).to.throw('Missing NOTE_ENCRYPTION_KEY for note encryption');

        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    it('can decrypt legacy payloads using the temporary session-secret fallback', () => {
        const legacySecret = 'legacy-session-secret-value-32-chars';
        const legacyKey = crypto.createHash('sha256').update(legacySecret).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
        const encrypted = Buffer.concat([
            cipher.update('Legacy note payload', 'utf8'),
            cipher.final()
        ]);
        const authTag = cipher.getAuthTag();
        const legacyCiphertext = `enc:v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

        process.env.SESSION_SECRET = legacySecret;
        process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK = 'true';

        expect(decryptText(legacyCiphertext)).to.equal('Legacy note payload');

        delete process.env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK;
    });
});
