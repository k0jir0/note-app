const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 1000 * 60 * 15;
const FAILURE_WINDOW_MS = 1000 * 60 * 15;

function getAuthenticationState(user = {}) {
    return user && user.authenticationState && typeof user.authenticationState === 'object'
        ? user.authenticationState
        : {};
}

function buildAuthenticationState(nextState = {}) {
    return {
        failedLoginAttempts: Number.isFinite(Number(nextState.failedLoginAttempts))
            ? Math.max(0, Number(nextState.failedLoginAttempts))
            : 0,
        lastFailedLoginAt: nextState.lastFailedLoginAt || null,
        lastFailedLoginIp: String(nextState.lastFailedLoginIp || '').trim(),
        lockoutUntil: nextState.lockoutUntil || null,
        lastSuccessfulLoginAt: nextState.lastSuccessfulLoginAt || null
    };
}

function persistAuthenticationState(user, nextState = {}) {
    if (!user || typeof user !== 'object') {
        return Promise.resolve(null);
    }

    user.authenticationState = buildAuthenticationState(nextState);

    if (typeof user.markModified === 'function') {
        user.markModified('authenticationState');
    }

    if (typeof user.save === 'function') {
        return user.save();
    }

    return Promise.resolve(user);
}

function isAccountLocked(user, { now = Date.now() } = {}) {
    const authenticationState = getAuthenticationState(user);
    const lockoutUntil = new Date(authenticationState.lockoutUntil).getTime();

    return Number.isFinite(lockoutUntil) && lockoutUntil > now;
}

function getLockoutRemainingMs(user, options = {}) {
    if (!isAccountLocked(user, options)) {
        return 0;
    }

    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const authenticationState = getAuthenticationState(user);
    const lockoutUntil = new Date(authenticationState.lockoutUntil).getTime();
    return Math.max(0, lockoutUntil - now);
}

async function recordFailedLoginAttempt(user, { ipAddress = '', now = Date.now() } = {}) {
    if (!user || typeof user !== 'object') {
        return {
            failedLoginAttempts: 0,
            locked: false,
            lockoutUntil: null
        };
    }

    const authenticationState = buildAuthenticationState(getAuthenticationState(user));
    const lastFailureAt = new Date(authenticationState.lastFailedLoginAt).getTime();
    const withinFailureWindow = Number.isFinite(lastFailureAt) && (now - lastFailureAt) <= FAILURE_WINDOW_MS;
    const failedLoginAttempts = withinFailureWindow
        ? authenticationState.failedLoginAttempts + 1
        : 1;
    const locked = failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    const lockoutUntil = locked ? new Date(now + LOCKOUT_DURATION_MS) : null;

    await persistAuthenticationState(user, {
        ...authenticationState,
        failedLoginAttempts,
        lastFailedLoginAt: new Date(now),
        lastFailedLoginIp: ipAddress,
        lockoutUntil,
        lastSuccessfulLoginAt: authenticationState.lastSuccessfulLoginAt || null
    });

    return {
        failedLoginAttempts,
        locked,
        lockoutUntil: lockoutUntil ? lockoutUntil.toISOString() : null
    };
}

async function clearFailedLoginAttempts(user, { now = Date.now() } = {}) {
    if (!user || typeof user !== 'object') {
        return null;
    }

    const authenticationState = buildAuthenticationState(getAuthenticationState(user));
    await persistAuthenticationState(user, {
        ...authenticationState,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lastFailedLoginIp: '',
        lockoutUntil: null,
        lastSuccessfulLoginAt: new Date(now)
    });

    return user.authenticationState;
}

module.exports = {
    FAILURE_WINDOW_MS,
    LOCKOUT_DURATION_MS,
    MAX_FAILED_LOGIN_ATTEMPTS,
    clearFailedLoginAttempts,
    getAuthenticationState,
    getLockoutRemainingMs,
    isAccountLocked,
    recordFailedLoginAttempt
};
