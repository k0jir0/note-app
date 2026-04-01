const crypto = require('crypto');

const {
    issueWebAuthnAuthenticationOptions,
    issueWebAuthnRegistrationOptions,
    normalizeStoredWebauthnCredentials,
    verifyWebAuthnAuthenticationResponse,
    verifyWebAuthnRegistrationResponse
} = require('./hardwareTokenWebauthnService');
const { extractClientCertificateEvidence } = require('./pkiRequestEvidenceService');

const HARDWARE_FIRST_MFA_METHODS = [
    'hardware_token',
    'pki_certificate'
];

const MFA_CHALLENGE_TTL_MS = 1000 * 60 * 5;
const MFA_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const SUPPORTED_HARDWARE_AUTHENTICATORS = [
    {
        method: 'hardware_token',
        label: 'Hardware token',
        standard: 'WebAuthn / FIDO2 security key',
        description: 'Uses a browser-mediated WebAuthn assertion signed by a registered hardware authenticator.',
        evidence: 'Signed WebAuthn assertion from a registered security key',
        assurance: 'Hardware-first'
    },
    {
        method: 'pki_certificate',
        label: 'PKI certificate',
        standard: 'Client certificate / PKI',
        description: 'Uses a mutual-TLS client certificate or trusted reverse-proxy certificate assertion tied to a managed identity.',
        evidence: 'Verified client certificate subject and issuer',
        assurance: 'Hardware-first'
    }
];

const HARDWARE_FIRST_POLICY_PRINCIPLES = [
    {
        id: 'hardware-first',
        label: 'Hardware-first step-up',
        description: 'High-impact actions should require a hardware token or PKI-backed certificate, not an SMS or other weak second factor.'
    },
    {
        id: 'managed-endpoint',
        label: 'Managed endpoint expectation',
        description: 'Strong factors only count when they are asserted from managed or hardened endpoints.'
    },
    {
        id: 'time-bound',
        label: 'Time-bound assurance',
        description: 'Step-up proof should expire quickly so the session does not retain elevated assurance indefinitely.'
    },
    {
        id: 'auditable-step-up',
        label: 'Auditable step-up',
        description: 'Every hardware-first verification should leave evidence of which factor was used, when it was verified, and when it expires.'
    }
];

function createMfaError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeMfaMethod(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return HARDWARE_FIRST_MFA_METHODS.includes(normalized) ? normalized : 'none';
}

function isHardwareFirstMfaMethod(method) {
    return HARDWARE_FIRST_MFA_METHODS.includes(normalizeMfaMethod(method));
}

function isSimulationAllowed() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.ALLOW_HARDWARE_MFA_SIMULATION || '').trim().toLowerCase() === 'true';
}

function requireSession(session) {
    if (!session || typeof session !== 'object') {
        throw createMfaError('MFA session state is unavailable.', 'SESSION_UNAVAILABLE');
    }
}

function persistAccessProfile(user, accessProfile) {
    if (!user || typeof user !== 'object') {
        return Promise.resolve(null);
    }

    user.accessProfile = accessProfile;
    if (typeof user.markModified === 'function') {
        user.markModified('accessProfile');
    }

    if (typeof user.save === 'function') {
        return user.save();
    }

    return Promise.resolve(user);
}

function buildBaseAccessProfile(user = {}) {
    const source = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : {};

    return {
        ...source,
        webauthnCredentials: normalizeStoredWebauthnCredentials(user).map((credential) => ({
            ...credential
        }))
    };
}

function buildCurrentHardwareMfaRegistration(session = {}) {
    const stored = session && session.hardwareFirstMfaRegistration ? session.hardwareFirstMfaRegistration : null;

    if (!stored) {
        return {
            active: false,
            expired: false,
            challengeId: '',
            issuedAt: '',
            expiresAt: ''
        };
    }

    const expiresAt = new Date(stored.expiresAt);
    const expired = Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();

    return {
        active: !expired,
        expired,
        challengeId: String(stored.challengeId || ''),
        issuedAt: String(stored.issuedAt || ''),
        expiresAt: String(stored.expiresAt || '')
    };
}

function clearExpiredHardwareMfaState(session = {}) {
    if (!session || typeof session !== 'object') {
        return;
    }

    const challenge = buildCurrentHardwareMfaChallenge(session);
    if (challenge.expired && session.hardwareFirstMfaChallenge) {
        delete session.hardwareFirstMfaChallenge;
    }

    const registration = buildCurrentHardwareMfaRegistration(session);
    if (registration.expired && session.hardwareFirstMfaRegistration) {
        delete session.hardwareFirstMfaRegistration;
    }

    const currentSession = buildCurrentHardwareMfaSession(session);
    if (!currentSession.verified && session.hardwareFirstMfa) {
        delete session.hardwareFirstMfa;
    }
}

function normalizeRegisteredAuthenticators(user = {}) {
    const source = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : user;
    const authenticators = [];
    const webauthnCredentials = normalizeStoredWebauthnCredentials(user);

    if (webauthnCredentials.length) {
        authenticators.push({
            method: 'hardware_token',
            kind: 'webauthn',
            label: webauthnCredentials.length === 1
                ? webauthnCredentials[0].label
                : `${webauthnCredentials.length} registered security keys`,
            serial: String(source.hardwareTokenSerial || '').trim(),
            registered: true,
            challengeHint: 'A browser WebAuthn prompt will ask for the registered security key.',
            evidence: 'Signed WebAuthn assertion',
            credentials: webauthnCredentials
        });
    } else if (source.registeredHardwareToken) {
        authenticators.push({
            method: 'hardware_token',
            kind: 'legacy',
            label: String(source.hardwareTokenLabel || 'Registered hardware token').trim(),
            serial: String(source.hardwareTokenSerial || '').trim(),
            registered: true,
            challengeHint: 'Development simulation only: type "touch", "present", or the token label.',
            evidence: 'Simulated security key presence confirmation',
            credentials: []
        });
    }

    if (source.registeredPkiCertificate) {
        authenticators.push({
            method: 'pki_certificate',
            label: String(source.pkiCertificateSubject || 'Registered PKI certificate').trim(),
            subject: String(source.pkiCertificateSubject || '').trim(),
            issuer: String(source.pkiCertificateIssuer || '').trim(),
            registered: true,
            challengeHint: 'Present the registered client certificate on the current request or through a trusted reverse proxy.',
            evidence: 'Verified certificate subject and issuer'
        });
    }

    return authenticators;
}

function getRegisteredAuthenticator(user = {}, method = '') {
    const normalizedMethod = normalizeMfaMethod(method);

    return normalizeRegisteredAuthenticators(user).find((authenticator) => authenticator.method === normalizedMethod) || null;
}

function buildCurrentHardwareMfaChallenge(session = {}) {
    const stored = session && session.hardwareFirstMfaChallenge ? session.hardwareFirstMfaChallenge : null;

    if (!stored) {
        return {
            active: false,
            expired: false,
            challengeId: '',
            method: 'none',
            verificationMode: '',
            issuedAt: '',
            expiresAt: '',
            credentialLabel: ''
        };
    }

    const expiresAt = new Date(stored.expiresAt);
    const expired = Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();

    return {
        active: !expired,
        expired,
        challengeId: String(stored.challengeId || ''),
        method: normalizeMfaMethod(stored.method),
        verificationMode: String(stored.verificationMode || ''),
        issuedAt: String(stored.issuedAt || ''),
        expiresAt: String(stored.expiresAt || ''),
        credentialLabel: String(stored.credentialLabel || '')
    };
}

function buildCurrentHardwareMfaSession(session = {}) {
    const stored = session && session.hardwareFirstMfa ? session.hardwareFirstMfa : null;

    if (!stored) {
        return {
            verified: false,
            assurance: 'password_only',
            method: 'none',
            hardwareFirst: false,
            verifiedAt: '',
            expiresAt: '',
            credentialLabel: '',
            source: ''
        };
    }

    const expiresAt = new Date(stored.expiresAt);
    const valid = !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();

    if (!valid) {
        return {
            verified: false,
            assurance: 'password_only',
            method: 'none',
            hardwareFirst: false,
            verifiedAt: '',
            expiresAt: '',
            credentialLabel: '',
            source: ''
        };
    }

    const method = normalizeMfaMethod(stored.method);

    return {
        verified: true,
        assurance: String(stored.assurance || 'hardware_first'),
        method,
        hardwareFirst: isHardwareFirstMfaMethod(method),
        verifiedAt: String(stored.verifiedAt || ''),
        expiresAt: String(stored.expiresAt || ''),
        credentialLabel: String(stored.credentialLabel || ''),
        source: String(stored.source || '')
    };
}

function buildChallengeInstructions(method, authenticator, verificationMode) {
    if (method === 'hardware_token' && verificationMode === 'webauthn_assertion') {
        return `Use ${authenticator.label} in the browser WebAuthn prompt to complete the step-up check.`;
    }

    if (method === 'hardware_token') {
        return `Use ${authenticator.label} and confirm token presence by typing "touch", "present", or the token label.`;
    }

    return 'Present the registered client certificate on this request or through a trusted reverse proxy that forwards verified certificate details.';
}

function issueHardwareTokenRegistrationOptions({ user, session, baseUrl } = {}) {
    requireSession(session);
    clearExpiredHardwareMfaState(session);

    const now = Date.now();
    const challengeId = `mfa-reg-${crypto.randomBytes(8).toString('hex')}`;
    const registration = issueWebAuthnRegistrationOptions({
        user,
        baseUrl
    });

    session.hardwareFirstMfaRegistration = {
        challengeId,
        challenge: registration.challenge,
        expectedOrigin: registration.expectedOrigin,
        rpId: registration.rpId,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MFA_CHALLENGE_TTL_MS).toISOString()
    };

    return {
        challengeId,
        issuedAt: session.hardwareFirstMfaRegistration.issuedAt,
        expiresAt: session.hardwareFirstMfaRegistration.expiresAt,
        publicKey: registration.options,
        instructions: 'Insert a hardware security key and approve the browser WebAuthn registration prompt.'
    };
}

async function verifyHardwareTokenRegistration({ user, session, registrationResponse } = {}) {
    requireSession(session);
    clearExpiredHardwareMfaState(session);

    const activeRegistration = buildCurrentHardwareMfaRegistration(session);
    if (!activeRegistration.active) {
        throw createMfaError('Start a new hardware-token registration before verifying it.', activeRegistration.expired ? 'REGISTRATION_EXPIRED' : 'REGISTRATION_REQUIRED');
    }

    const verifiedCredential = verifyWebAuthnRegistrationResponse({
        expectedChallenge: session.hardwareFirstMfaRegistration.challenge,
        expectedOrigin: session.hardwareFirstMfaRegistration.expectedOrigin,
        rpId: session.hardwareFirstMfaRegistration.rpId,
        response: registrationResponse
    });
    const accessProfile = buildBaseAccessProfile(user);
    const existingCredentials = accessProfile.webauthnCredentials.filter(
        (credential) => credential.credentialId !== verifiedCredential.credentialId
    );

    accessProfile.webauthnCredentials = [...existingCredentials, verifiedCredential];
    accessProfile.registeredHardwareToken = true;
    accessProfile.hardwareTokenLabel = verifiedCredential.label;

    await persistAccessProfile(user, accessProfile);
    delete session.hardwareFirstMfaRegistration;

    return {
        registered: true,
        credentialId: verifiedCredential.credentialId,
        label: verifiedCredential.label,
        credentialCount: accessProfile.webauthnCredentials.length
    };
}

function issueHardwareFirstMfaChallenge({ user, session, method, baseUrl } = {}) {
    requireSession(session);
    clearExpiredHardwareMfaState(session);

    const normalizedMethod = normalizeMfaMethod(method);
    if (!isHardwareFirstMfaMethod(normalizedMethod)) {
        throw createMfaError(`Unsupported hardware-first MFA method: ${method}`, 'UNKNOWN_MFA_METHOD');
    }

    const authenticator = getRegisteredAuthenticator(user, normalizedMethod);
    if (!authenticator) {
        throw createMfaError(`No registered authenticator is available for ${normalizedMethod}.`, 'FACTOR_UNAVAILABLE');
    }

    const now = Date.now();
    const challenge = {
        challengeId: `mfa-${crypto.randomBytes(8).toString('hex')}`,
        method: normalizedMethod,
        verificationMode: normalizedMethod === 'hardware_token' && authenticator.kind === 'webauthn'
            ? 'webauthn_assertion'
            : (normalizedMethod === 'pki_certificate' ? 'client_certificate' : 'legacy_presence'),
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MFA_CHALLENGE_TTL_MS).toISOString(),
        credentialLabel: authenticator.label || authenticator.subject || ''
    };

    if (challenge.verificationMode === 'webauthn_assertion') {
        const webauthnChallenge = issueWebAuthnAuthenticationOptions({
            user,
            baseUrl
        });

        challenge.challenge = webauthnChallenge.challenge;
        challenge.expectedOrigin = webauthnChallenge.expectedOrigin;
        challenge.rpId = webauthnChallenge.rpId;
        challenge.publicKey = webauthnChallenge.options;
    }

    session.hardwareFirstMfaChallenge = challenge;

    return {
        challengeId: challenge.challengeId,
        method: challenge.method,
        verificationMode: challenge.verificationMode,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
        credentialLabel: challenge.credentialLabel,
        publicKey: challenge.publicKey,
        instructions: buildChallengeInstructions(normalizedMethod, authenticator, challenge.verificationMode)
    };
}

async function verifyHardwareFirstMfaChallenge({
    user,
    session,
    challengeId,
    method,
    responseValue,
    assertion,
    requestEvidence
} = {}) {
    requireSession(session);
    clearExpiredHardwareMfaState(session);

    const activeChallenge = buildCurrentHardwareMfaChallenge(session);
    if (!activeChallenge.active) {
        throw createMfaError('Start a new hardware-first MFA challenge before verifying.', activeChallenge.expired ? 'CHALLENGE_EXPIRED' : 'CHALLENGE_REQUIRED');
    }

    const normalizedMethod = normalizeMfaMethod(method || activeChallenge.method);
    if (!isHardwareFirstMfaMethod(normalizedMethod)) {
        throw createMfaError(`Unsupported hardware-first MFA method: ${method}`, 'UNKNOWN_MFA_METHOD');
    }

    if (String(challengeId || '').trim() !== activeChallenge.challengeId) {
        throw createMfaError('The provided challenge id does not match the active MFA challenge.', 'CHALLENGE_MISMATCH');
    }

    if (normalizedMethod !== activeChallenge.method) {
        throw createMfaError('The provided MFA method does not match the active challenge.', 'CHALLENGE_MISMATCH');
    }

    const authenticator = getRegisteredAuthenticator(user, normalizedMethod);
    if (!authenticator) {
        throw createMfaError(`No registered authenticator is available for ${normalizedMethod}.`, 'FACTOR_UNAVAILABLE');
    }

    let credentialLabel = authenticator.label || authenticator.subject || '';
    let source = activeChallenge.verificationMode || '';

    if (normalizedMethod === 'hardware_token' && activeChallenge.verificationMode === 'webauthn_assertion') {
        const verification = verifyWebAuthnAuthenticationResponse({
            expectedChallenge: session.hardwareFirstMfaChallenge.challenge,
            expectedOrigin: session.hardwareFirstMfaChallenge.expectedOrigin,
            rpId: session.hardwareFirstMfaChallenge.rpId,
            credentials: normalizeStoredWebauthnCredentials(user),
            response: assertion
        });
        const accessProfile = buildBaseAccessProfile(user);

        accessProfile.webauthnCredentials = accessProfile.webauthnCredentials.map((credential) => (
            credential.credentialId === verification.credentialId
                ? { ...credential, counter: verification.counter }
                : credential
        ));
        accessProfile.registeredHardwareToken = true;
        await persistAccessProfile(user, accessProfile);
        credentialLabel = verification.label;
        source = 'webauthn';
    } else if (normalizedMethod === 'hardware_token') {
        if (!isSimulationAllowed()) {
            throw createMfaError('Real hardware-token verification requires a registered WebAuthn credential.', 'WEBAUTHN_REQUIRED');
        }

        const proof = String(responseValue || '').trim();
        const acceptedValues = new Set([
            'touch',
            'present',
            'verified',
            String(authenticator.label || '').trim().toLowerCase()
        ].filter(Boolean));

        if (!acceptedValues.has(proof.toLowerCase())) {
            throw createMfaError('The hardware-token proof was not recognized. Use "touch", "present", or the registered token label.', 'INVALID_HARDWARE_PROOF');
        }

        source = 'simulation';
    } else {
        const evidence = requestEvidence || null;
        if (evidence && evidence.verified) {
            const expectedSubject = String(authenticator.subject || '').trim().toLowerCase();
            const expectedIssuer = String(authenticator.issuer || '').trim().toLowerCase();
            const actualSubject = String(evidence.subject || '').trim().toLowerCase();
            const actualIssuer = String(evidence.issuer || '').trim().toLowerCase();

            if (expectedSubject && actualSubject !== expectedSubject) {
                throw createMfaError('The presented certificate subject did not match the registered PKI certificate.', 'INVALID_CERTIFICATE_ASSERTION');
            }

            if (expectedIssuer && actualIssuer && actualIssuer !== expectedIssuer) {
                throw createMfaError('The presented certificate issuer did not match the registered PKI certificate.', 'INVALID_CERTIFICATE_ASSERTION');
            }

            credentialLabel = evidence.subject || credentialLabel;
            source = evidence.source || 'client_certificate';
        } else if (isSimulationAllowed()) {
            const proof = String(responseValue || '').trim();
            if (!proof || proof.toLowerCase() !== String(authenticator.subject || '').trim().toLowerCase()) {
                throw createMfaError('The certificate subject did not match the registered PKI certificate.', 'INVALID_CERTIFICATE_ASSERTION');
            }

            source = 'simulation';
        } else {
            throw createMfaError('A verified client certificate is required to satisfy PKI-based hardware-first MFA.', 'PKI_CLIENT_CERT_REQUIRED');
        }
    }

    const now = Date.now();
    session.hardwareFirstMfa = {
        verifiedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MFA_SESSION_TTL_MS).toISOString(),
        method: normalizedMethod,
        assurance: 'hardware_first',
        credentialLabel,
        source
    };

    delete session.hardwareFirstMfaChallenge;
    return buildCurrentHardwareMfaSession(session);
}

async function registerCurrentPkiCertificate({ user, requestEvidence } = {}) {
    const evidence = requestEvidence || null;
    if (!evidence || !evidence.verified || !evidence.subject) {
        throw createMfaError('A verified client certificate is required before it can be registered.', 'PKI_CLIENT_CERT_REQUIRED');
    }

    const accessProfile = buildBaseAccessProfile(user);
    accessProfile.registeredPkiCertificate = true;
    accessProfile.pkiCertificateSubject = evidence.subject;
    accessProfile.pkiCertificateIssuer = evidence.issuer || accessProfile.pkiCertificateIssuer || '';

    await persistAccessProfile(user, accessProfile);

    return {
        registered: true,
        subject: accessProfile.pkiCertificateSubject,
        issuer: accessProfile.pkiCertificateIssuer,
        source: evidence.source || 'client_certificate'
    };
}

function revokeHardwareFirstMfaSession({ session } = {}) {
    requireSession(session);
    delete session.hardwareFirstMfa;
    delete session.hardwareFirstMfaChallenge;
    return buildCurrentHardwareMfaSession(session);
}

function mergeSessionHardwareMfaIntoUser(user, session = {}) {
    if (!user) {
        return user;
    }

    clearExpiredHardwareMfaState(session);
    const currentSession = buildCurrentHardwareMfaSession(session);

    if (!currentSession.verified) {
        return user;
    }

    const baseUser = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    const baseAccessProfile = user.accessProfile && typeof user.accessProfile === 'object'
        ? { ...user.accessProfile }
        : {};

    return {
        ...baseUser,
        accessProfile: {
            ...baseAccessProfile,
            mfaVerifiedAt: new Date(currentSession.verifiedAt),
            mfaMethod: currentSession.method,
            mfaAssurance: currentSession.assurance,
            mfaHardwareFirst: currentSession.hardwareFirst
        }
    };
}

module.exports = {
    HARDWARE_FIRST_MFA_METHODS,
    HARDWARE_FIRST_POLICY_PRINCIPLES,
    SUPPORTED_HARDWARE_AUTHENTICATORS,
    buildCurrentHardwareMfaChallenge,
    buildCurrentHardwareMfaRegistration,
    buildCurrentHardwareMfaSession,
    clearExpiredHardwareMfaState,
    extractClientCertificateEvidence,
    getRegisteredAuthenticator,
    isHardwareFirstMfaMethod,
    issueHardwareFirstMfaChallenge,
    issueHardwareTokenRegistrationOptions,
    mergeSessionHardwareMfaIntoUser,
    normalizeMfaMethod,
    normalizeRegisteredAuthenticators,
    registerCurrentPkiCertificate,
    revokeHardwareFirstMfaSession,
    verifyHardwareFirstMfaChallenge,
    verifyHardwareTokenRegistration
};
