const {
    isHardwareFirstMfaMethod,
    normalizeMfaMethod,
    normalizeRegisteredAuthenticators
} = require('./hardwareFirstMfaService');
const {
    ACTION_CATALOG,
    CLEARANCE_LEVELS,
    DEFAULT_USER_PROFILE,
    DEVICE_TIERS,
    MATRIX_COMBINATIONS,
    MISSION_ROLES,
    NETWORK_ZONES,
    POLICY_PRINCIPLES,
    RECOMMENDED_CONTROLS,
    RESOURCE_CATALOG,
    SAMPLE_PERSONAS,
    getMissionAction,
    getMissionPersona,
    getMissionResource,
    listMissionActions,
    listMissionPersonas,
    listMissionResources
} = require('./missionAccessControl/catalog');

function rankOf(list, value, fallbackIndex = 0) {
    const index = list.indexOf(value);
    return index === -1 ? fallbackIndex : index;
}

function isValidMissionRole(value) {
    return MISSION_ROLES.includes(String(value || '').trim().toLowerCase());
}

function isValidClearance(value) {
    return CLEARANCE_LEVELS.includes(String(value || '').trim().toLowerCase());
}

function isValidDeviceTier(value) {
    return DEVICE_TIERS.includes(String(value || '').trim().toLowerCase());
}

function isValidNetworkZone(value) {
    return NETWORK_ZONES.includes(String(value || '').trim().toLowerCase());
}

function normalizeMissionList(items, fallback = DEFAULT_USER_PROFILE.assignedMissions) {
    const values = Array.isArray(items)
        ? items
        : (typeof items === 'string' && items.trim()
            ? items.split(',')
            : []);

    const normalized = Array.from(new Set(values
        .map((value) => String(value || '').trim())
        .filter(Boolean)));

    return normalized.length ? normalized : [...fallback];
}

function normalizeNetworkZoneList(items, fallback = DEFAULT_USER_PROFILE.networkZones) {
    const values = Array.isArray(items)
        ? items
        : (typeof items === 'string' && items.trim()
            ? items.split(',')
            : []);

    const normalized = Array.from(new Set(values
        .map((value) => String(value || '').trim().toLowerCase())
        .filter((value) => isValidNetworkZone(value))));

    return normalized.length ? normalized : [...fallback];
}

function normalizeUserAccessProfile(user = {}) {
    const source = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : user;
    const registeredAuthenticators = normalizeRegisteredAuthenticators(user);
    const missionRole = String(source.missionRole || DEFAULT_USER_PROFILE.missionRole).trim().toLowerCase();
    const clearance = String(source.clearance || DEFAULT_USER_PROFILE.clearance).trim().toLowerCase();
    const deviceTier = String(source.deviceTier || DEFAULT_USER_PROFILE.deviceTier).trim().toLowerCase();
    const normalizedMfaMethod = normalizeMfaMethod(source.mfaMethod || DEFAULT_USER_PROFILE.mfaMethod);
    const mfaHardwareFirst = Boolean(source.mfaHardwareFirst || isHardwareFirstMfaMethod(normalizedMfaMethod));

    return {
        id: user && user._id ? String(user._id) : '',
        displayName: String(source.displayName || user.name || user.email || 'Current user'),
        email: String(user.email || ''),
        missionRole: isValidMissionRole(missionRole) ? missionRole : DEFAULT_USER_PROFILE.missionRole,
        clearance: isValidClearance(clearance) ? clearance : DEFAULT_USER_PROFILE.clearance,
        unit: String(source.unit || DEFAULT_USER_PROFILE.unit).trim() || DEFAULT_USER_PROFILE.unit,
        assignedMissions: normalizeMissionList(source.assignedMissions, DEFAULT_USER_PROFILE.assignedMissions),
        deviceTier: isValidDeviceTier(deviceTier) ? deviceTier : DEFAULT_USER_PROFILE.deviceTier,
        networkZones: normalizeNetworkZoneList(source.networkZones, DEFAULT_USER_PROFILE.networkZones),
        mfaVerified: Boolean(source.mfaVerified || source.mfaVerifiedAt),
        mfaMethod: normalizedMfaMethod,
        mfaAssurance: mfaHardwareFirst ? 'hardware_first' : 'password_only',
        mfaHardwareFirst,
        registeredAuthenticators,
        breakGlassApproved: Boolean(source.breakGlassApproved),
        breakGlassReason: String(source.breakGlassReason || '').trim()
    };
}

function buildEvaluationContext(subject, contextOverrides = {}) {
    const requestedNetworkZone = String(contextOverrides.networkZone || '').trim().toLowerCase();
    const requestedDeviceTier = String(contextOverrides.deviceTier || '').trim().toLowerCase();

    return {
        networkZone: isValidNetworkZone(requestedNetworkZone)
            ? requestedNetworkZone
            : (subject.networkZones[0] || 'corp'),
        deviceTier: isValidDeviceTier(requestedDeviceTier)
            ? requestedDeviceTier
            : subject.deviceTier,
        currentTime: contextOverrides.currentTime || new Date().toISOString(),
        justification: String(contextOverrides.justification || '').trim()
    };
}

function buildCheck(id, label, passed, detail, failedDetail, severity = 'gate') {
    return {
        id,
        label,
        passed: !!passed,
        severity,
        detail: passed ? detail : failedDetail
    };
}

function evaluateMissionAccess({ user, subject, actionId, resourceId, contextOverrides = {} } = {}) {
    const resolvedAction = getMissionAction(actionId);
    const resolvedResource = getMissionResource(resourceId);

    if (!resolvedAction) {
        const error = new Error(`Unknown mission access action: ${actionId}`);
        error.code = 'UNKNOWN_ACTION';
        throw error;
    }

    if (!resolvedResource) {
        const error = new Error(`Unknown mission access resource: ${resourceId}`);
        error.code = 'UNKNOWN_RESOURCE';
        throw error;
    }

    const resolvedSubject = normalizeUserAccessProfile(subject || user);
    const context = buildEvaluationContext(resolvedSubject, contextOverrides);
    const breakGlassActive = resolvedSubject.breakGlassApproved
        && Boolean((resolvedSubject.breakGlassReason || context.justification).trim());
    const requiredMfaMethod = String(
        resolvedAction.requiredMfaMethod || resolvedResource.requiredMfaMethod || 'none'
    ).trim().toLowerCase();

    const checks = [];
    const roleAllowed = resolvedAction.allowedRoles.includes(resolvedSubject.missionRole)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'role',
        'Role baseline',
        roleAllowed,
        `${resolvedSubject.missionRole} is permitted to attempt ${resolvedAction.label.toLowerCase()}.`,
        `${resolvedSubject.missionRole} is not an approved role for ${resolvedAction.label.toLowerCase()}.`
    ));

    const actionAllowedForResource = resolvedResource.allowedActions.includes(resolvedAction.id);
    checks.push(buildCheck(
        'resource-action',
        'Action matches resource',
        actionAllowedForResource,
        `${resolvedAction.label} is a valid action for ${resolvedResource.title}.`,
        `${resolvedAction.label} is not exposed for ${resolvedResource.title}.`
    ));

    const clearancePass = rankOf(CLEARANCE_LEVELS, resolvedSubject.clearance)
        >= rankOf(CLEARANCE_LEVELS, resolvedResource.classification);
    checks.push(buildCheck(
        'clearance',
        'Security clearance',
        clearancePass,
        `${resolvedSubject.clearance} meets or exceeds ${resolvedResource.classification}.`,
        `${resolvedSubject.clearance} does not meet the ${resolvedResource.classification} classification requirement.`
    ));

    const missionPass = resolvedSubject.assignedMissions.includes(resolvedResource.missionId)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'mission',
        'Mission assignment',
        missionPass,
        `${resolvedSubject.displayName} is assigned to ${resolvedResource.missionId}.`,
        `${resolvedSubject.displayName} is not assigned to ${resolvedResource.missionId}.`
    ));

    const unitPass = !resolvedResource.allowedUnits.length
        || resolvedResource.allowedUnits.includes(resolvedSubject.unit)
        || (breakGlassActive && resolvedAction.breakGlassEligible);
    checks.push(buildCheck(
        'unit',
        'Unit restriction',
        unitPass,
        resolvedResource.allowedUnits.length
            ? `${resolvedSubject.unit} is in the allowed unit list.`
            : 'No unit restriction is applied to this resource.',
        `${resolvedSubject.unit} is not permitted for this resource.`
    ));

    const devicePass = rankOf(DEVICE_TIERS, context.deviceTier)
        >= rankOf(DEVICE_TIERS, resolvedResource.requiredDeviceTier);
    checks.push(buildCheck(
        'device',
        'Device trust',
        devicePass,
        `${context.deviceTier} device trust satisfies the ${resolvedResource.requiredDeviceTier} requirement.`,
        `${context.deviceTier} device trust does not satisfy the ${resolvedResource.requiredDeviceTier} requirement.`
    ));

    const zonePass = resolvedAction.allowedNetworkZones.includes(context.networkZone)
        && resolvedResource.allowedNetworkZones.includes(context.networkZone);
    checks.push(buildCheck(
        'network',
        'Network zone',
        zonePass,
        `${context.networkZone} is an approved network zone for this action and resource.`,
        `${context.networkZone} is not an approved network zone for this action and resource.`
    ));

    const mfaRequired = resolvedAction.requiresMfa || resolvedResource.requiresMfa;
    const hardwareFirstRequired = mfaRequired && requiredMfaMethod === 'hardware_first';
    const mfaPass = !mfaRequired || (
        resolvedSubject.mfaVerified
        && (!hardwareFirstRequired || resolvedSubject.mfaHardwareFirst)
    );
    const mfaSuccessDetail = hardwareFirstRequired
        ? `Hardware-first MFA is verified through ${resolvedSubject.mfaMethod === 'pki_certificate' ? 'a PKI certificate' : 'a hardware token'}.`
        : (mfaRequired
            ? 'Fresh MFA evidence is present for this sensitive action.'
            : 'This action does not require step-up MFA.');
    const mfaFailureDetail = hardwareFirstRequired
        ? 'A verified hardware token or PKI certificate is required before this action can proceed.'
        : (mfaRequired
            ? 'Fresh MFA evidence is required before this action can proceed.'
            : 'This action does not require step-up MFA.');
    checks.push(buildCheck(
        'mfa',
        'Step-up authentication',
        mfaPass,
        mfaSuccessDetail,
        mfaFailureDetail
    ));

    const justificationPass = !breakGlassActive
        || Boolean((context.justification || resolvedSubject.breakGlassReason).trim());
    checks.push(buildCheck(
        'justification',
        'Break-glass justification',
        justificationPass,
        breakGlassActive
            ? 'Break-glass justification is recorded.'
            : 'No break-glass override is in effect.',
        'Break-glass access requires a recorded justification.'
    ));

    const allowed = checks.every((check) => check.passed);
    const obligations = [];

    if (allowed) {
        obligations.push('Record an immutable audit event with role, clearance, network zone, and resource id.');

        if (mfaRequired) {
            obligations.push(
                hardwareFirstRequired
                    ? 'Bind the approval to the current hardware token or PKI-backed proof and expire it after the action completes.'
                    : 'Bind the approval to the current MFA proof and expire it after the action completes.'
            );
        }

        if (breakGlassActive) {
            obligations.push('Flag the decision for after-action review because break-glass access was used.');
        }

        if (resolvedAction.sensitivity === 'critical') {
            obligations.push('Require dual review or post-action commander acknowledgement for critical changes.');
        }
    }

    return {
        allowed,
        decision: allowed ? 'allow' : 'deny',
        summary: allowed
            ? `${resolvedSubject.displayName} may ${resolvedAction.label.toLowerCase()} on ${resolvedResource.title}.`
            : `${resolvedSubject.displayName} may not ${resolvedAction.label.toLowerCase()} on ${resolvedResource.title}.`,
        action: resolvedAction,
        resource: resolvedResource,
        subject: resolvedSubject,
        context,
        breakGlassActive,
        checks,
        satisfiedChecks: checks.filter((check) => check.passed),
        failedChecks: checks.filter((check) => !check.passed),
        obligations
    };
}

function buildDecisionMatrix(subject) {
    const entries = MATRIX_COMBINATIONS.map((combination) => evaluateMissionAccess({
        subject,
        actionId: combination.actionId,
        resourceId: combination.resourceId,
        contextOverrides: {
            networkZone: subject.networkZones[0] || 'corp',
            justification: subject.breakGlassReason || ''
        }
    })).map((result) => ({
        actionId: result.action.id,
        actionLabel: result.action.label,
        resourceId: result.resource.id,
        resourceTitle: result.resource.title,
        decision: result.decision,
        allowed: result.allowed,
        failedChecks: result.failedChecks.map((check) => check.label),
        summary: result.summary
    }));

    return {
        allowedCount: entries.filter((entry) => entry.allowed).length,
        deniedCount: entries.filter((entry) => !entry.allowed).length,
        entries
    };
}

function buildCurrentUserPersona(user) {
    const profile = normalizeUserAccessProfile(user);

    return {
        id: 'current-user',
        label: `${profile.displayName} (Current Session)`,
        summary: 'Use the current session identity so the module reflects the access profile that is active right now.',
        ...profile
    };
}

module.exports = {
    ACTION_CATALOG,
    CLEARANCE_LEVELS,
    DEFAULT_USER_PROFILE,
    DEVICE_TIERS,
    MISSION_ROLES,
    NETWORK_ZONES,
    POLICY_PRINCIPLES,
    RECOMMENDED_CONTROLS,
    RESOURCE_CATALOG,
    SAMPLE_PERSONAS,
    buildCurrentUserPersona,
    buildDecisionMatrix,
    evaluateMissionAccess,
    getMissionAction,
    getMissionPersona,
    getMissionResource,
    isValidNetworkZone,
    listMissionActions,
    listMissionPersonas,
    listMissionResources,
    normalizeUserAccessProfile
};
