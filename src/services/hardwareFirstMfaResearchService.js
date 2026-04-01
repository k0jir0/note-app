const {
    HARDWARE_FIRST_POLICY_PRINCIPLES,
    SUPPORTED_HARDWARE_AUTHENTICATORS,
    buildCurrentHardwareMfaChallenge,
    buildCurrentHardwareMfaRegistration,
    buildCurrentHardwareMfaSession,
    issueHardwareFirstMfaChallenge,
    issueHardwareTokenRegistrationOptions,
    mergeSessionHardwareMfaIntoUser,
    normalizeRegisteredAuthenticators,
    registerCurrentPkiCertificate,
    revokeHardwareFirstMfaSession,
    verifyHardwareFirstMfaChallenge,
    verifyHardwareTokenRegistration
} = require('./hardwareFirstMfaService');
const {
    listMissionActions,
    normalizeUserAccessProfile
} = require('./missionAccessControlService');

function normalizeBaseUrl(baseUrl) {
    const value = String(baseUrl || '').trim();
    return value || 'http://localhost:3000';
}

function normalizeTransportSecurity(transportSecurity = {}) {
    return {
        protocol: transportSecurity && transportSecurity.httpsEnabled ? 'https' : 'http',
        httpsEnabled: Boolean(transportSecurity && transportSecurity.httpsEnabled),
        requestClientCertificate: Boolean(transportSecurity && transportSecurity.requestClientCertificate),
        requireClientCertificate: Boolean(transportSecurity && transportSecurity.requireClientCertificate),
        trustProxyClientCertHeaders: Boolean(transportSecurity && transportSecurity.trustProxyClientCertHeaders)
    };
}

function buildSensitiveActionSummary() {
    return listMissionActions()
        .filter((action) => action.requiresMfa || action.requiredMfaMethod === 'hardware_first')
        .map((action) => ({
            id: action.id,
            label: action.label,
            description: action.description,
            sensitivity: action.sensitivity,
            requiredMfaMethod: action.requiredMfaMethod || 'none'
        }));
}

function buildHardwareFirstMfaModuleOverview({ user, session, baseUrl, transportSecurity } = {}) {
    const mergedUser = mergeSessionHardwareMfaIntoUser(user, session);
    const currentProfile = normalizeUserAccessProfile(mergedUser);
    const transport = normalizeTransportSecurity(transportSecurity);

    return {
        module: {
            name: 'Hardware-Backed MFA Module',
            focus: 'Hardware-token and PKI-backed step-up assurance',
            route: '/hardware-mfa/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        environment: {
            transport
        },
        currentProfile,
        sessionAssurance: buildCurrentHardwareMfaSession(session),
        activeChallenge: buildCurrentHardwareMfaChallenge(session),
        activeRegistration: buildCurrentHardwareMfaRegistration(session),
        registeredAuthenticators: normalizeRegisteredAuthenticators(mergedUser),
        supportedAuthenticators: SUPPORTED_HARDWARE_AUTHENTICATORS.map((authenticator) => ({ ...authenticator })),
        policyPrinciples: HARDWARE_FIRST_POLICY_PRINCIPLES.map((principle) => ({ ...principle })),
        sensitiveActions: buildSensitiveActionSummary(),
        capabilities: {
            webauthnRegistration: true,
            pkiRegistration: transport.requestClientCertificate || transport.trustProxyClientCertHeaders,
            directMutualTls: transport.requestClientCertificate,
            trustedProxyCertificateHeaders: transport.trustProxyClientCertHeaders
        }
    };
}

function startHardwareFirstMfaChallenge({ user, session, method, baseUrl } = {}) {
    return issueHardwareFirstMfaChallenge({
        user,
        session,
        method,
        baseUrl
    });
}

function verifyHardwareFirstMfaStepUp({ user, session, method, challengeId, responseValue, assertion, requestEvidence } = {}) {
    return verifyHardwareFirstMfaChallenge({
        user,
        session,
        method,
        challengeId,
        responseValue,
        assertion,
        requestEvidence
    });
}

function revokeHardwareFirstMfaStepUp({ session } = {}) {
    return revokeHardwareFirstMfaSession({ session });
}

function startHardwareTokenRegistration({ user, session, baseUrl } = {}) {
    return issueHardwareTokenRegistrationOptions({
        user,
        session,
        baseUrl
    });
}

function verifyHardwareTokenRegistrationFlow({ user, session, registrationResponse } = {}) {
    return verifyHardwareTokenRegistration({
        user,
        session,
        registrationResponse
    });
}

function registerCurrentPkiCertificateForUser({ user, requestEvidence } = {}) {
    return registerCurrentPkiCertificate({
        user,
        requestEvidence
    });
}

module.exports = {
    buildHardwareFirstMfaModuleOverview,
    revokeHardwareFirstMfaStepUp,
    registerCurrentPkiCertificateForUser,
    startHardwareFirstMfaChallenge,
    startHardwareTokenRegistration,
    verifyHardwareTokenRegistrationFlow,
    verifyHardwareFirstMfaStepUp
};
