const crypto = require('crypto');

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
        standard: 'FIDO2 / security key',
        description: 'Uses a hardware-backed token presence check for step-up approval.',
        evidence: 'Physical token touch or presence confirmation',
        assurance: 'Hardware-first'
    },
    {
        method: 'pki_certificate',
        label: 'PKI certificate',
        standard: 'Client certificate / PKI',
        description: 'Uses a certificate-backed subject assertion tied to a managed identity.',
        evidence: 'Client certificate subject and issuer',
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

function normalizeRegisteredAuthenticators(user = {}) {
    const source = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : user;
    const authenticators = [];

    if (source.registeredHardwareToken) {
        authenticators.push({
            method: 'hardware_token',
            label: String(source.hardwareTokenLabel || 'Registered hardware token').trim(),
            serial: String(source.hardwareTokenSerial || '').trim(),
            registered: true,
            challengeHint: 'Type "touch", "present", or the token label to simulate hardware presence.',
            evidence: 'Security key presence confirmation'
        });
    }

    if (source.registeredPkiCertificate) {
        authenticators.push({
            method: 'pki_certificate',
            label: String(source.pkiCertificateSubject || 'Registered PKI certificate').trim(),
            subject: String(source.pkiCertificateSubject || '').trim(),
            issuer: String(source.pkiCertificateIssuer || '').trim(),
            registered: true,
            challengeHint: 'Provide the registered certificate subject to simulate a client-certificate assertion.',
            evidence: 'Certificate subject plus issuing authority'
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
        issuedAt: String(stored.issuedAt || ''),
        expiresAt: String(stored.expiresAt || ''),
        credentialLabel: String(stored.credentialLabel || stored.certificateSubject || '')
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
            credentialLabel: ''
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
            credentialLabel: ''
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
        credentialLabel: String(stored.credentialLabel || stored.certificateSubject || '')
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

    const currentSession = buildCurrentHardwareMfaSession(session);
    if (!currentSession.verified && session.hardwareFirstMfa) {
        delete session.hardwareFirstMfa;
    }
}

function requireSession(session) {
    if (!session || typeof session !== 'object') {
        throw createMfaError('MFA session state is unavailable.', 'SESSION_UNAVAILABLE');
    }
}

function buildChallengeInstructions(method, authenticator) {
    if (method === 'hardware_token') {
        return `Use ${authenticator.label} and confirm token presence by typing "touch", "present", or the token label.`;
    }

    return `Use the registered certificate subject for ${authenticator.label} to simulate a PKI-backed client certificate assertion.`;
}

function issueHardwareFirstMfaChallenge({ user, session, method } = {}) {
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
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MFA_CHALLENGE_TTL_MS).toISOString(),
        credentialLabel: authenticator.label || authenticator.subject || ''
    };

    session.hardwareFirstMfaChallenge = challenge;

    return {
        ...challenge,
        instructions: buildChallengeInstructions(normalizedMethod, authenticator)
    };
}

function verifyHardwareFirstMfaChallenge({ user, session, challengeId, method, responseValue } = {}) {
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

    const proof = String(responseValue || '').trim();
    if (!proof) {
        throw createMfaError('A verification response is required to complete hardware-first MFA.', 'VERIFICATION_REQUIRED');
    }

    if (normalizedMethod === 'hardware_token') {
        const acceptedValues = new Set([
            'touch',
            'present',
            'verified',
            String(authenticator.label || '').trim().toLowerCase()
        ].filter(Boolean));

        if (!acceptedValues.has(proof.toLowerCase())) {
            throw createMfaError('The hardware-token proof was not recognized. Use "touch", "present", or the registered token label.', 'INVALID_HARDWARE_PROOF');
        }
    }

    if (normalizedMethod === 'pki_certificate') {
        if (proof.toLowerCase() !== String(authenticator.subject || '').trim().toLowerCase()) {
            throw createMfaError('The certificate subject did not match the registered PKI certificate.', 'INVALID_CERTIFICATE_ASSERTION');
        }
    }

    const now = Date.now();
    session.hardwareFirstMfa = {
        verifiedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + MFA_SESSION_TTL_MS).toISOString(),
        method: normalizedMethod,
        assurance: 'hardware_first',
        credentialLabel: authenticator.label || authenticator.subject || ''
    };

    delete session.hardwareFirstMfaChallenge;
    return buildCurrentHardwareMfaSession(session);
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
    buildCurrentHardwareMfaSession,
    clearExpiredHardwareMfaState,
    getRegisteredAuthenticator,
    isHardwareFirstMfaMethod,
    issueHardwareFirstMfaChallenge,
    mergeSessionHardwareMfaIntoUser,
    normalizeMfaMethod,
    normalizeRegisteredAuthenticators,
    revokeHardwareFirstMfaSession,
    verifyHardwareFirstMfaChallenge
};
