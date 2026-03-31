const { canControlBreakGlass } = require('./breakGlassService');
const { buildCurrentHardwareMfaSession } = require('./hardwareFirstMfaService');

const PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS = 1000 * 60 * 10;

function resolveMissionRole(user = {}) {
    return String(user && user.accessProfile && user.accessProfile.missionRole || '')
        .trim()
        .toLowerCase();
}

function canReadPrivilegedRuntime(user) {
    const missionRole = resolveMissionRole(user);
    return missionRole === 'admin';
}

function canMutatePrivilegedRuntime(user) {
    return canReadPrivilegedRuntime(user);
}

function hasRecentHardwareStepUp(session, { maxAgeMs = PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS, now = Date.now() } = {}) {
    const assurance = buildCurrentHardwareMfaSession(session);

    if (!assurance.verified || !assurance.hardwareFirst) {
        return false;
    }

    const verifiedAt = new Date(assurance.verifiedAt).getTime();
    if (!Number.isFinite(verifiedAt)) {
        return false;
    }

    return (now - verifiedAt) <= maxAgeMs;
}

function canManageBreakGlassRuntime(user) {
    return canControlBreakGlass(user);
}

module.exports = {
    PRIVILEGED_RUNTIME_STEP_UP_WINDOW_MS,
    canManageBreakGlassRuntime,
    canMutatePrivilegedRuntime,
    canReadPrivilegedRuntime,
    hasRecentHardwareStepUp,
    resolveMissionRole
};
