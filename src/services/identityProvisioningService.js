const SELF_REGISTERED_ACCESS_PROFILE = Object.freeze({
    missionRole: 'external',
    clearance: 'unclassified',
    unit: 'external-collaboration',
    assignedMissions: [],
    deviceTier: 'unknown',
    networkZones: ['public'],
    mfaVerifiedAt: null,
    registeredHardwareToken: false,
    hardwareTokenLabel: '',
    hardwareTokenSerial: '',
    webauthnCredentials: [],
    registeredPkiCertificate: false,
    pkiCertificateSubject: '',
    pkiCertificateIssuer: '',
    breakGlassApproved: false,
    breakGlassReason: ''
});

function getIdentityLifecycleConfig(runtimeConfig = {}) {
    if (runtimeConfig && runtimeConfig.identityLifecycle) {
        return runtimeConfig.identityLifecycle;
    }

    return {
        protectedRuntime: false,
        selfSignupEnabled: true,
        googleAutoProvisionEnabled: true
    };
}

function isSelfSignupEnabled(runtimeConfig = {}) {
    return Boolean(getIdentityLifecycleConfig(runtimeConfig).selfSignupEnabled);
}

function isGoogleAutoProvisionEnabled(runtimeConfig = {}) {
    return Boolean(getIdentityLifecycleConfig(runtimeConfig).googleAutoProvisionEnabled);
}

function buildSelfRegisteredAccessProfile(overrides = {}) {
    return {
        ...SELF_REGISTERED_ACCESS_PROFILE,
        ...overrides,
        assignedMissions: Array.isArray(overrides.assignedMissions)
            ? [...overrides.assignedMissions]
            : [...SELF_REGISTERED_ACCESS_PROFILE.assignedMissions],
        networkZones: Array.isArray(overrides.networkZones)
            ? [...overrides.networkZones]
            : [...SELF_REGISTERED_ACCESS_PROFILE.networkZones],
        webauthnCredentials: Array.isArray(overrides.webauthnCredentials)
            ? [...overrides.webauthnCredentials]
            : [...SELF_REGISTERED_ACCESS_PROFILE.webauthnCredentials]
    };
}

module.exports = {
    SELF_REGISTERED_ACCESS_PROFILE,
    buildSelfRegisteredAccessProfile,
    getIdentityLifecycleConfig,
    isGoogleAutoProvisionEnabled,
    isSelfSignupEnabled
};
