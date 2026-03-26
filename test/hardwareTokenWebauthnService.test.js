const crypto = require('crypto');
const { expect } = require('chai');

const {
    issueWebAuthnAuthenticationOptions,
    issueWebAuthnRegistrationOptions,
    verifyWebAuthnAuthenticationResponse,
    verifyWebAuthnRegistrationResponse
} = require('../src/services/hardwareTokenWebauthnService');

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest();
}

function toBase64Url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function buildAuthenticatorData(rpId, signCount = 0) {
    const signCountBuffer = Buffer.alloc(4);
    signCountBuffer.writeUInt32BE(signCount, 0);
    return Buffer.concat([
        sha256(Buffer.from(rpId)),
        Buffer.from([0x01]),
        signCountBuffer
    ]);
}

describe('Hardware-token WebAuthn service', () => {
    it('verifies a WebAuthn registration response and returns a stored credential record', () => {
        const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const registration = issueWebAuthnRegistrationOptions({
            user: {
                _id: '507f1f77bcf86cd799439011',
                email: 'tester@example.com',
                accessProfile: { webauthnCredentials: [] }
            },
            baseUrl: 'http://localhost:3000'
        });
        const rawId = Buffer.from('credential-1');
        const clientDataJSON = Buffer.from(JSON.stringify({
            type: 'webauthn.create',
            challenge: registration.challenge,
            origin: registration.expectedOrigin
        }));
        const authenticatorData = buildAuthenticatorData(registration.rpId, 0);
        const response = {
            id: toBase64Url(rawId),
            rawId: toBase64Url(rawId),
            response: {
                clientDataJSON: toBase64Url(clientDataJSON),
                authenticatorData: toBase64Url(authenticatorData),
                publicKey: toBase64Url(publicKey.export({ format: 'der', type: 'spki' })),
                publicKeyAlgorithm: -7,
                transports: ['usb']
            },
            label: 'YubiKey 5'
        };

        const credential = verifyWebAuthnRegistrationResponse({
            expectedChallenge: registration.challenge,
            expectedOrigin: registration.expectedOrigin,
            rpId: registration.rpId,
            response
        });

        expect(credential.credentialId).to.equal(toBase64Url(rawId));
        expect(credential.publicKey).to.be.a('string').that.is.not.empty;
        expect(credential.label).to.equal('YubiKey 5');
        expect(credential.transports).to.deep.equal(['usb']);
    });

    it('verifies a signed WebAuthn assertion and advances the credential counter', () => {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const rawId = Buffer.from('credential-2');
        const storedCredential = {
            credentialId: toBase64Url(rawId),
            publicKey: toBase64Url(publicKey.export({ format: 'der', type: 'spki' })),
            counter: 1,
            label: 'Mission key'
        };
        const authentication = issueWebAuthnAuthenticationOptions({
            user: {
                accessProfile: {
                    webauthnCredentials: [storedCredential]
                }
            },
            baseUrl: 'http://localhost:3000'
        });
        const clientDataJSON = Buffer.from(JSON.stringify({
            type: 'webauthn.get',
            challenge: authentication.challenge,
            origin: authentication.expectedOrigin
        }));
        const authenticatorData = buildAuthenticatorData(authentication.rpId, 2);
        const signedPayload = Buffer.concat([
            authenticatorData,
            sha256(clientDataJSON)
        ]);
        const signature = crypto.sign('sha256', signedPayload, privateKey);
        const response = {
            id: toBase64Url(rawId),
            rawId: toBase64Url(rawId),
            response: {
                clientDataJSON: toBase64Url(clientDataJSON),
                authenticatorData: toBase64Url(authenticatorData),
                signature: toBase64Url(signature)
            }
        };

        const verification = verifyWebAuthnAuthenticationResponse({
            expectedChallenge: authentication.challenge,
            expectedOrigin: authentication.expectedOrigin,
            rpId: authentication.rpId,
            credentials: [storedCredential],
            response
        });

        expect(verification.credentialId).to.equal(storedCredential.credentialId);
        expect(verification.counter).to.equal(2);
        expect(verification.label).to.equal('Mission key');
    });
});
