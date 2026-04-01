const { VALID_BREAK_GLASS_MODES, isNonEmptyString } = require('./helpers');

function buildBreakGlassConfig(env, errors) {
    const rawMode = env.BREAK_GLASS_MODE === undefined
        ? 'disabled'
        : String(env.BREAK_GLASS_MODE).trim().toLowerCase();
    const modeAliases = {
        '': 'disabled',
        off: 'disabled',
        disabled: 'disabled',
        readonly: 'read_only',
        'read-only': 'read_only',
        read_only: 'read_only',
        offline: 'offline'
    };
    const mode = Object.prototype.hasOwnProperty.call(modeAliases, rawMode)
        ? modeAliases[rawMode]
        : null;

    if (!mode) {
        errors.push(`BREAK_GLASS_MODE must be one of: ${VALID_BREAK_GLASS_MODES.join(', ')}`);
        return {
            mode: 'disabled',
            reason: ''
        };
    }

    const reason = isNonEmptyString(env.BREAK_GLASS_REASON) ? env.BREAK_GLASS_REASON.trim() : '';
    if (mode !== 'disabled' && !reason) {
        errors.push('BREAK_GLASS_REASON is required when BREAK_GLASS_MODE is enabled');
    }

    return {
        mode,
        reason
    };
}

module.exports = {
    buildBreakGlassConfig
};
