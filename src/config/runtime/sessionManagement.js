const { parseBooleanEnv, parseIntegerEnv } = require('./helpers');

function buildSessionManagementConfig(env, errors) {
    const idleTimeoutMinutes = parseIntegerEnv('SESSION_IDLE_TIMEOUT_MINUTES', env, {
        defaultValue: 15,
        min: 1,
        max: 240
    }, errors);
    const absoluteTimeoutHours = parseIntegerEnv('SESSION_ABSOLUTE_TIMEOUT_HOURS', env, {
        defaultValue: 8,
        min: 1,
        max: 24
    }, errors);
    const missionIdleTimeoutMinutes = parseIntegerEnv('MISSION_SESSION_IDLE_TIMEOUT_MINUTES', env, {
        defaultValue: 5,
        min: 1,
        max: 120
    }, errors);
    const missionAbsoluteTimeoutHours = parseIntegerEnv('MISSION_SESSION_ABSOLUTE_TIMEOUT_HOURS', env, {
        defaultValue: 2,
        min: 1,
        max: 12
    }, errors);
    const preventConcurrentLogins = env.PREVENT_CONCURRENT_LOGINS === undefined
        ? true
        : parseBooleanEnv('PREVENT_CONCURRENT_LOGINS', env, errors);

    if (missionIdleTimeoutMinutes > idleTimeoutMinutes) {
        errors.push('MISSION_SESSION_IDLE_TIMEOUT_MINUTES must be less than or equal to SESSION_IDLE_TIMEOUT_MINUTES');
    }

    if (missionAbsoluteTimeoutHours > absoluteTimeoutHours) {
        errors.push('MISSION_SESSION_ABSOLUTE_TIMEOUT_HOURS must be less than or equal to SESSION_ABSOLUTE_TIMEOUT_HOURS');
    }

    return {
        idleTimeoutMinutes,
        idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
        absoluteTimeoutHours,
        absoluteTimeoutMs: absoluteTimeoutHours * 60 * 60 * 1000,
        missionIdleTimeoutMinutes,
        missionIdleTimeoutMs: missionIdleTimeoutMinutes * 60 * 1000,
        missionAbsoluteTimeoutHours,
        missionAbsoluteTimeoutMs: missionAbsoluteTimeoutHours * 60 * 60 * 1000,
        preventConcurrentLogins
    };
}

module.exports = {
    buildSessionManagementConfig
};
