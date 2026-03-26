const {
    HARDWARE_FIRST_POLICY_PRINCIPLES,
    SUPPORTED_HARDWARE_AUTHENTICATORS,
    buildCurrentHardwareMfaChallenge,
    buildCurrentHardwareMfaSession,
    issueHardwareFirstMfaChallenge,
    mergeSessionHardwareMfaIntoUser,
    normalizeRegisteredAuthenticators,
    revokeHardwareFirstMfaSession,
    verifyHardwareFirstMfaChallenge
} = require('./hardwareFirstMfaService');
const {
    listMissionActions,
    normalizeUserAccessProfile
} = require('./missionAccessControlService');

function normalizeBaseUrl(baseUrl) {
    const value = String(baseUrl || '').trim();
    return value || 'http://localhost:3000';
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

function buildHardwareFirstMfaModuleOverview({ user, session, baseUrl } = {}) {
    const mergedUser = mergeSessionHardwareMfaIntoUser(user, session);
    const currentProfile = normalizeUserAccessProfile(mergedUser);

    return {
        module: {
            name: 'Hardware-First MFA Module',
            focus: 'Hardware-token and PKI-backed step-up assurance',
            route: '/hardware-mfa/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        currentProfile,
        sessionAssurance: buildCurrentHardwareMfaSession(session),
        activeChallenge: buildCurrentHardwareMfaChallenge(session),
        registeredAuthenticators: normalizeRegisteredAuthenticators(mergedUser),
        supportedAuthenticators: SUPPORTED_HARDWARE_AUTHENTICATORS.map((authenticator) => ({ ...authenticator })),
        policyPrinciples: HARDWARE_FIRST_POLICY_PRINCIPLES.map((principle) => ({ ...principle })),
        sensitiveActions: buildSensitiveActionSummary()
    };
}

function startHardwareFirstMfaChallenge({ user, session, method } = {}) {
    return issueHardwareFirstMfaChallenge({
        user,
        session,
        method
    });
}

function verifyHardwareFirstMfaStepUp({ user, session, method, challengeId, responseValue } = {}) {
    return verifyHardwareFirstMfaChallenge({
        user,
        session,
        method,
        challengeId,
        responseValue
    });
}

function revokeHardwareFirstMfaStepUp({ session } = {}) {
    return revokeHardwareFirstMfaSession({ session });
}

module.exports = {
    buildHardwareFirstMfaModuleOverview,
    revokeHardwareFirstMfaStepUp,
    startHardwareFirstMfaChallenge,
    verifyHardwareFirstMfaStepUp
};
