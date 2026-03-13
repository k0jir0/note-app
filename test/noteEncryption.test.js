const { expect } = require('chai');

const {
    isEncryptedValue,
    encryptText,
    decryptText,
    encryptNoteUpdatePayload
} = require('../src/utils/noteEncryption');

describe('Note Encryption Utility', () => {
    const originalNoteKey = process.env.NOTE_ENCRYPTION_KEY;
    const originalSessionSecret = process.env.SESSION_SECRET;

    before(() => {
        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    after(() => {
        if (originalNoteKey === undefined) {
            delete process.env.NOTE_ENCRYPTION_KEY;
        } else {
            process.env.NOTE_ENCRYPTION_KEY = originalNoteKey;
        }

        if (originalSessionSecret === undefined) {
            delete process.env.SESSION_SECRET;
        } else {
            process.env.SESSION_SECRET = originalSessionSecret;
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
});
