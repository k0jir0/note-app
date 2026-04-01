const BREAK_GLASS_MODES = Object.freeze({
    DISABLED: 'disabled',
    READ_ONLY: 'read_only',
    OFFLINE: 'offline'
});

const BREAK_GLASS_CONTROL_ROLES = new Set(['admin', 'break_glass']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeBreakGlassMode(value) {
    const normalized = String(value || BREAK_GLASS_MODES.DISABLED).trim().toLowerCase();

    if (normalized === '' || normalized === 'disabled' || normalized === 'off') {
        return BREAK_GLASS_MODES.DISABLED;
    }

    if (normalized === 'read_only' || normalized === 'read-only' || normalized === 'readonly') {
        return BREAK_GLASS_MODES.READ_ONLY;
    }

    if (normalized === BREAK_GLASS_MODES.OFFLINE) {
        return BREAK_GLASS_MODES.OFFLINE;
    }

    return null;
}

function isBreakGlassModeEnabled(mode) {
    return normalizeBreakGlassMode(mode) !== BREAK_GLASS_MODES.DISABLED;
}

function buildBreakGlassState({
    mode = BREAK_GLASS_MODES.DISABLED,
    reason = '',
    activatedAt = null,
    activatedBy = ''
} = {}) {
    const normalizedMode = normalizeBreakGlassMode(mode) || BREAK_GLASS_MODES.DISABLED;
    const enabled = normalizedMode !== BREAK_GLASS_MODES.DISABLED;

    return {
        mode: normalizedMode,
        enabled,
        readOnly: normalizedMode === BREAK_GLASS_MODES.READ_ONLY,
        offline: normalizedMode === BREAK_GLASS_MODES.OFFLINE,
        reason: enabled ? String(reason || '').trim() : '',
        activatedAt: enabled ? (activatedAt || new Date().toISOString()) : null,
        activatedBy: enabled ? String(activatedBy || '').trim() : ''
    };
}

function updateBreakGlassState(currentState = {}, nextState = {}) {
    const normalizedMode = normalizeBreakGlassMode(nextState.mode);
    if (!normalizedMode) {
        return null;
    }

    if (normalizedMode === BREAK_GLASS_MODES.DISABLED) {
        return buildBreakGlassState({ mode: normalizedMode });
    }

    return buildBreakGlassState({
        mode: normalizedMode,
        reason: nextState.reason,
        activatedAt: currentState && currentState.mode === normalizedMode
            ? currentState.activatedAt
            : nextState.activatedAt,
        activatedBy: nextState.activatedBy
    });
}

function canControlBreakGlass(user) {
    const missionRole = String(user && user.accessProfile && user.accessProfile.missionRole || '').trim().toLowerCase();
    return BREAK_GLASS_CONTROL_ROLES.has(missionRole);
}

function isWriteMethod(method) {
    return WRITE_METHODS.has(String(method || '').trim().toUpperCase());
}

module.exports = {
    BREAK_GLASS_CONTROL_ROLES,
    BREAK_GLASS_MODES,
    buildBreakGlassState,
    canControlBreakGlass,
    isBreakGlassModeEnabled,
    isWriteMethod,
    normalizeBreakGlassMode,
    updateBreakGlassState
};
