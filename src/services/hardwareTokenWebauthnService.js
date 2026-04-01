const crypto = require('crypto');

const CHALLENGE_BYTES = 32;
const RP_NAME = 'test-app';

function createWebAuthnError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function toBase64Url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value) {
    return Buffer.from(String(value || ''), 'base64url');
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest();
}

function normalizeBaseUrl(baseUrl = '') {
    const value = String(baseUrl || '').trim() || 'http://localhost:3000';
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
}

function buildOrigin(baseUrl = '') {
    return normalizeBaseUrl(baseUrl);
}

function buildRpId(baseUrl = '') {
    return new URL(normalizeBaseUrl(baseUrl)).hostname;
}

function parseClientDataJSON(clientDataJSON) {
    try {
        return JSON.parse(Buffer.from(clientDataJSON).toString('utf8'));
    } catch (_error) {
        throw createWebAuthnError('The WebAuthn client data could not be parsed.', 'WEBAUTHN_INVALID_CLIENT_DATA');
    }
}

function parseAuthenticatorData(authenticatorDataBuffer) {
    const buffer = Buffer.from(authenticatorDataBuffer);
    if (buffer.length < 37) {
        throw createWebAuthnError('Authenticator data was too short.', 'WEBAUTHN_INVALID_AUTH_DATA');
    }

    return {
        rpIdHash: buffer.subarray(0, 32),
        flags: buffer[32],
        signCount: buffer.readUInt32BE(33),
        raw: buffer
    };
}

function ensureExpectedClientData(clientData, expectedChallenge, expectedOrigin, expectedType) {
    if (clientData.type !== expectedType) {
        throw createWebAuthnError(`Expected WebAuthn response type ${expectedType}.`, 'WEBAUTHN_INVALID_TYPE');
    }

    if (String(clientData.challenge || '') !== String(expectedChallenge || '')) {
        throw createWebAuthnError('The WebAuthn challenge did not match the active session challenge.', 'WEBAUTHN_CHALLENGE_MISMATCH');
    }

    if (String(clientData.origin || '') !== String(expectedOrigin || '')) {
        throw createWebAuthnError('The WebAuthn origin did not match the configured RP origin.', 'WEBAUTHN_ORIGIN_MISMATCH');
    }
}

function ensureAuthenticatorData(authenticatorData, expectedRpId) {
    const expectedRpHash = sha256(Buffer.from(expectedRpId));
    const flags = authenticatorData.flags;
    const userPresent = (flags & 0x01) === 0x01;

    if (!crypto.timingSafeEqual(authenticatorData.rpIdHash, expectedRpHash)) {
        throw createWebAuthnError('The authenticator did not sign for the expected relying party.', 'WEBAUTHN_RP_MISMATCH');
    }

    if (!userPresent) {
        throw createWebAuthnError('The authenticator did not report user presence.', 'WEBAUTHN_USER_PRESENCE_REQUIRED');
    }
}

function normalizeCredentialId(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        throw createWebAuthnError('A credential id is required.', 'WEBAUTHN_CREDENTIAL_REQUIRED');
    }

    return toBase64Url(fromBase64Url(raw));
}

function normalizeStoredWebauthnCredentials(source = {}) {
    const accessProfile = source && source.accessProfile && typeof source.accessProfile === 'object'
        ? source.accessProfile
        : source;
    const credentials = Array.isArray(accessProfile.webauthnCredentials)
        ? accessProfile.webauthnCredentials
        : [];

    return credentials
        .map((credential) => ({
            credentialId: normalizeCredentialId(credential.credentialId),
            publicKey: String(credential.publicKey || '').trim(),
            counter: Number.isFinite(credential.counter) ? credential.counter : 0,
            transports: Array.isArray(credential.transports) ? [...credential.transports] : [],
            label: String(credential.label || 'Registered security key').trim(),
            addedAt: String(credential.addedAt || ''),
            algorithm: credential.algorithm ?? null
        }))
        .filter((credential) => credential.publicKey);
}

function buildCredentialDescriptor(credential) {
    return {
        type: 'public-key',
        id: credential.credentialId,
        transports: credential.transports
    };
}

function issueWebAuthnRegistrationOptions({ user, baseUrl } = {}) {
    const userId = Buffer.from(String(user && (user._id || user.id || user.email || 'user')));
    const challenge = toBase64Url(crypto.randomBytes(CHALLENGE_BYTES));
    const rpId = buildRpId(baseUrl);
    const origin = buildOrigin(baseUrl);
    const existingCredentials = normalizeStoredWebauthnCredentials(user);

    return {
        challenge,
        expectedOrigin: origin,
        rpId,
        options: {
            challenge,
            rp: {
                id: rpId,
                name: RP_NAME
            },
            user: {
                id: toBase64Url(userId),
                name: String(user?.email || 'user'),
                displayName: String(user?.name || user?.email || 'Current user')
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            },
            excludeCredentials: existingCredentials.map(buildCredentialDescriptor)
        }
    };
}

function verifyWebAuthnRegistrationResponse({ expectedChallenge, expectedOrigin, rpId, response } = {}) {
    const rawId = normalizeCredentialId(response?.rawId || response?.id);
    const clientDataJSON = fromBase64Url(response?.response?.clientDataJSON);
    const authenticatorDataBuffer = fromBase64Url(response?.response?.authenticatorData);
    const publicKeyBuffer = fromBase64Url(response?.response?.publicKey);

    if (!clientDataJSON.length || !authenticatorDataBuffer.length || !publicKeyBuffer.length) {
        throw createWebAuthnError('The WebAuthn registration response was incomplete.', 'WEBAUTHN_REGISTRATION_INCOMPLETE');
    }

    const clientData = parseClientDataJSON(clientDataJSON);
    ensureExpectedClientData(clientData, expectedChallenge, expectedOrigin, 'webauthn.create');

    const authenticatorData = parseAuthenticatorData(authenticatorDataBuffer);
    ensureAuthenticatorData(authenticatorData, rpId);

    return {
        credentialId: rawId,
        publicKey: toBase64Url(publicKeyBuffer),
        counter: authenticatorData.signCount,
        transports: Array.isArray(response?.response?.transports) ? [...response.response.transports] : [],
        label: String(response?.label || 'Registered security key').trim() || 'Registered security key',
        algorithm: Number.isFinite(response?.response?.publicKeyAlgorithm)
            ? response.response.publicKeyAlgorithm
            : null,
        addedAt: new Date().toISOString()
    };
}

function issueWebAuthnAuthenticationOptions({ user, baseUrl } = {}) {
    const challenge = toBase64Url(crypto.randomBytes(CHALLENGE_BYTES));
    const rpId = buildRpId(baseUrl);
    const origin = buildOrigin(baseUrl);
    const credentials = normalizeStoredWebauthnCredentials(user);

    if (!credentials.length) {
        throw createWebAuthnError('No registered WebAuthn hardware token is available for this account.', 'WEBAUTHN_NO_CREDENTIALS');
    }

    return {
        challenge,
        expectedOrigin: origin,
        rpId,
        options: {
            challenge,
            rpId,
            timeout: 60000,
            userVerification: 'preferred',
            allowCredentials: credentials.map(buildCredentialDescriptor)
        }
    };
}

function verifyWebAuthnAuthenticationResponse({ expectedChallenge, expectedOrigin, rpId, credentials, response } = {}) {
    const credentialId = normalizeCredentialId(response?.rawId || response?.id);
    const storedCredential = (Array.isArray(credentials) ? credentials : []).find((credential) => credential.credentialId === credentialId);

    if (!storedCredential) {
        throw createWebAuthnError('The presented security key is not registered for this account.', 'WEBAUTHN_UNKNOWN_CREDENTIAL');
    }

    const clientDataJSON = fromBase64Url(response?.response?.clientDataJSON);
    const authenticatorDataBuffer = fromBase64Url(response?.response?.authenticatorData);
    const signatureBuffer = fromBase64Url(response?.response?.signature);

    if (!clientDataJSON.length || !authenticatorDataBuffer.length || !signatureBuffer.length) {
        throw createWebAuthnError('The WebAuthn authentication response was incomplete.', 'WEBAUTHN_ASSERTION_INCOMPLETE');
    }

    const clientData = parseClientDataJSON(clientDataJSON);
    ensureExpectedClientData(clientData, expectedChallenge, expectedOrigin, 'webauthn.get');

    const authenticatorData = parseAuthenticatorData(authenticatorDataBuffer);
    ensureAuthenticatorData(authenticatorData, rpId);

    const signedPayload = Buffer.concat([
        authenticatorData.raw,
        sha256(clientDataJSON)
    ]);
    const publicKey = crypto.createPublicKey({
        key: fromBase64Url(storedCredential.publicKey),
        format: 'der',
        type: 'spki'
    });
    const validSignature = crypto.verify('sha256', signedPayload, publicKey, signatureBuffer);

    if (!validSignature) {
        throw createWebAuthnError('The security key assertion signature was invalid.', 'WEBAUTHN_INVALID_SIGNATURE');
    }

    const previousCounter = Number.isFinite(storedCredential.counter) ? storedCredential.counter : 0;
    const currentCounter = authenticatorData.signCount;

    if (previousCounter > 0 && currentCounter > 0 && currentCounter <= previousCounter) {
        throw createWebAuthnError('The security key signature counter did not advance.', 'WEBAUTHN_COUNTER_REGRESSION');
    }

    return {
        credentialId,
        counter: currentCounter,
        label: storedCredential.label || 'Registered security key'
    };
}

module.exports = {
    buildOrigin,
    buildRpId,
    createWebAuthnError,
    fromBase64Url,
    issueWebAuthnAuthenticationOptions,
    issueWebAuthnRegistrationOptions,
    normalizeStoredWebauthnCredentials,
    toBase64Url,
    verifyWebAuthnAuthenticationResponse,
    verifyWebAuthnRegistrationResponse
};
