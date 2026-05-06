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

const OPEN_RUNTIME_SELF_REGISTERED_ACCESS_PROFILE = Object.freeze({
    missionRole: 'analyst',
    clearance: 'protected_b',
    unit: 'cyber-task-force',
    assignedMissions: ['research-workspace', 'browser-assurance'],
    deviceTier: 'managed',
    networkZones: ['corp'],
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

function isOpenSelfSignupRuntime(runtimeConfig = {}) {
    const identityLifecycle = getIdentityLifecycleConfig(runtimeConfig);
    return Boolean(identityLifecycle.selfSignupEnabled) && !Boolean(identityLifecycle.protectedRuntime);
}

function resolveSelfRegisteredProfileArgs(runtimeConfigOrOverrides = {}, maybeOverrides = {}) {
    const firstArg = runtimeConfigOrOverrides && typeof runtimeConfigOrOverrides === 'object'
        ? runtimeConfigOrOverrides
        : {};

    const looksLikeRuntimeConfig = Boolean(firstArg.identityLifecycle)
        || Object.prototype.hasOwnProperty.call(firstArg, 'protectedRuntime')
        || Object.prototype.hasOwnProperty.call(firstArg, 'selfSignupEnabled')
        || Object.prototype.hasOwnProperty.call(firstArg, 'googleAutoProvisionEnabled')
        || Object.prototype.hasOwnProperty.call(firstArg, 'runtimePosture');

    if (looksLikeRuntimeConfig) {
        return {
            runtimeConfig: firstArg,
            overrides: maybeOverrides && typeof maybeOverrides === 'object' ? maybeOverrides : {}
        };
    }

    return {
        runtimeConfig: {},
        overrides: firstArg
    };
}

function buildSelfRegisteredAccessProfile(runtimeConfigOrOverrides = {}, maybeOverrides = {}) {
    const { runtimeConfig, overrides } = resolveSelfRegisteredProfileArgs(runtimeConfigOrOverrides, maybeOverrides);
    const baseProfile = isOpenSelfSignupRuntime(runtimeConfig)
        ? OPEN_RUNTIME_SELF_REGISTERED_ACCESS_PROFILE
        : SELF_REGISTERED_ACCESS_PROFILE;

    return {
        ...baseProfile,
        ...overrides,
        assignedMissions: Array.isArray(overrides.assignedMissions)
            ? [...overrides.assignedMissions]
            : [...baseProfile.assignedMissions],
        networkZones: Array.isArray(overrides.networkZones)
            ? [...overrides.networkZones]
            : [...baseProfile.networkZones],
        webauthnCredentials: Array.isArray(overrides.webauthnCredentials)
            ? [...overrides.webauthnCredentials]
            : [...baseProfile.webauthnCredentials]
    };
}

function isLegacyExternalSelfRegisteredProfile(accessProfile = {}) {
    const assignedMissions = Array.isArray(accessProfile.assignedMissions) ? accessProfile.assignedMissions : [];
    const networkZones = Array.isArray(accessProfile.networkZones) ? accessProfile.networkZones : [];

    return String(accessProfile.missionRole || '').trim().toLowerCase() === 'external'
        && String(accessProfile.clearance || '').trim().toLowerCase() === 'unclassified'
        && String(accessProfile.unit || '').trim() === 'external-collaboration'
        && String(accessProfile.deviceTier || '').trim().toLowerCase() === 'unknown'
        && assignedMissions.length === 0
        && networkZones.length === 1
        && String(networkZones[0] || '').trim().toLowerCase() === 'public';
}

function upgradeLegacySelfRegisteredAccessProfile(user, runtimeConfig = {}) {
    if (!user || !isOpenSelfSignupRuntime(runtimeConfig)) {
        return false;
    }

    const currentProfile = user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : {};

    if (!isLegacyExternalSelfRegisteredProfile(currentProfile)) {
        return false;
    }

    user.accessProfile = buildSelfRegisteredAccessProfile(runtimeConfig, {
        mfaVerifiedAt: currentProfile.mfaVerifiedAt || null,
        registeredHardwareToken: Boolean(currentProfile.registeredHardwareToken),
        hardwareTokenLabel: String(currentProfile.hardwareTokenLabel || ''),
        hardwareTokenSerial: String(currentProfile.hardwareTokenSerial || ''),
        webauthnCredentials: Array.isArray(currentProfile.webauthnCredentials)
            ? [...currentProfile.webauthnCredentials]
            : [],
        registeredPkiCertificate: Boolean(currentProfile.registeredPkiCertificate),
        pkiCertificateSubject: String(currentProfile.pkiCertificateSubject || ''),
        pkiCertificateIssuer: String(currentProfile.pkiCertificateIssuer || ''),
        breakGlassApproved: Boolean(currentProfile.breakGlassApproved),
        breakGlassReason: String(currentProfile.breakGlassReason || '')
    });

    if (typeof user.markModified === 'function') {
        user.markModified('accessProfile');
    }

    return true;
}

module.exports = {
    OPEN_RUNTIME_SELF_REGISTERED_ACCESS_PROFILE,
    SELF_REGISTERED_ACCESS_PROFILE,
    buildSelfRegisteredAccessProfile,
    getIdentityLifecycleConfig,
    isGoogleAutoProvisionEnabled,
    isOpenSelfSignupRuntime,
    isSelfSignupEnabled,
    upgradeLegacySelfRegisteredAccessProfile
};
