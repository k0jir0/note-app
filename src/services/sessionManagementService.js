const crypto = require('crypto');

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const DEFAULT_MISSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MISSION_ABSOLUTE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

const SESSION_LOCK_REASONS = {
    NONE: '',
    IDLE_TIMEOUT: 'idle_timeout',
    ABSOLUTE_TIMEOUT: 'absolute_timeout',
    CONCURRENT_LOGIN: 'concurrent_login',
    MANUAL_LOCKDOWN: 'manual_lockdown'
};

function toIso(timestamp) {
    const numericValue = typeof timestamp === 'number' ? timestamp : Date.now();
    return new Date(numericValue).toISOString();
}

function parseTimestamp(value, fallback) {
    const parsed = Date.parse(String(value || ''));
    return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeSessionManagementConfig(runtimeConfig = {}) {
    const source = runtimeConfig && runtimeConfig.sessionManagement && typeof runtimeConfig.sessionManagement === 'object'
        ? runtimeConfig.sessionManagement
        : {};

    return {
        idleTimeoutMs: Number.isFinite(source.idleTimeoutMs) ? source.idleTimeoutMs : DEFAULT_IDLE_TIMEOUT_MS,
        absoluteTimeoutMs: Number.isFinite(source.absoluteTimeoutMs) ? source.absoluteTimeoutMs : DEFAULT_ABSOLUTE_TIMEOUT_MS,
        missionIdleTimeoutMs: Number.isFinite(source.missionIdleTimeoutMs) ? source.missionIdleTimeoutMs : DEFAULT_MISSION_IDLE_TIMEOUT_MS,
        missionAbsoluteTimeoutMs: Number.isFinite(source.missionAbsoluteTimeoutMs) ? source.missionAbsoluteTimeoutMs : DEFAULT_MISSION_ABSOLUTE_TIMEOUT_MS,
        preventConcurrentLogins: source.preventConcurrentLogins !== false
    };
}

function normalizeUserSessionControl(user = {}) {
    const source = user && user.sessionControl && typeof user.sessionControl === 'object'
        ? user.sessionControl
        : {};

    return {
        activeSessionId: String(source.activeSessionId || '').trim(),
        activeSessionIssuedAt: source.activeSessionIssuedAt || null,
        lastLockReason: String(source.lastLockReason || '').trim(),
        lastLockAt: source.lastLockAt || null
    };
}

function inferNetworkZone(user = {}, sessionState = {}) {
    const sessionZone = String(sessionState.networkZone || '').trim().toLowerCase();
    if (sessionZone) {
        return sessionZone;
    }

    const accessProfile = user && user.accessProfile && typeof user.accessProfile === 'object'
        ? user.accessProfile
        : {};
    const zones = Array.isArray(accessProfile.networkZones)
        ? accessProfile.networkZones.map((zone) => String(zone || '').trim().toLowerCase()).filter(Boolean)
        : [];

    if (zones.includes('mission')) {
        return 'mission';
    }

    if (zones.includes('public')) {
        return 'public';
    }

    return 'corp';
}

function buildSessionPolicy({ user, session, runtimeConfig } = {}) {
    const config = normalizeSessionManagementConfig(runtimeConfig);
    const currentState = session && session.sessionManagement && typeof session.sessionManagement === 'object'
        ? session.sessionManagement
        : {};
    const networkZone = inferNetworkZone(user, currentState);
    const fieldDeployed = networkZone === 'mission' || networkZone === 'public';

    return {
        networkZone,
        fieldDeployed,
        idleTimeoutMs: fieldDeployed ? config.missionIdleTimeoutMs : config.idleTimeoutMs,
        absoluteTimeoutMs: fieldDeployed ? config.missionAbsoluteTimeoutMs : config.absoluteTimeoutMs,
        preventConcurrentLogins: config.preventConcurrentLogins
    };
}

function describeLockReason(lockReason = '') {
    switch (lockReason) {
        case SESSION_LOCK_REASONS.IDLE_TIMEOUT:
            return 'The session exceeded the permitted idle timeout and was locked.';
        case SESSION_LOCK_REASONS.ABSOLUTE_TIMEOUT:
            return 'The session reached its maximum lifetime and was locked.';
        case SESSION_LOCK_REASONS.CONCURRENT_LOGIN:
            return 'The account authenticated in another browser session, so this session was locked.';
        case SESSION_LOCK_REASONS.MANUAL_LOCKDOWN:
            return 'The session was locked manually.';
        default:
            return 'The session is active.';
    }
}

function buildCurrentSessionState({ user, session, runtimeConfig, now = Date.now() } = {}) {
    const policy = buildSessionPolicy({
        user,
        session,
        runtimeConfig
    });
    const userControl = normalizeUserSessionControl(user);
    const storedState = session && session.sessionManagement && typeof session.sessionManagement === 'object'
        ? session.sessionManagement
        : null;

    if (!storedState) {
        return {
            tracked: false,
            valid: false,
            active: false,
            sessionId: '',
            userId: '',
            issuedAt: '',
            lastActivityAt: '',
            idleExpiresAt: '',
            absoluteExpiresAt: '',
            idleTimeoutMs: policy.idleTimeoutMs,
            absoluteTimeoutMs: policy.absoluteTimeoutMs,
            remainingIdleMs: 0,
            remainingAbsoluteMs: 0,
            networkZone: policy.networkZone,
            fieldDeployed: policy.fieldDeployed,
            preventConcurrentLogins: policy.preventConcurrentLogins,
            supersededByNewLogin: false,
            lockReason: '',
            lockReasonDescription: 'No authenticated session is currently being tracked.'
        };
    }

    const issuedAtMs = parseTimestamp(storedState.issuedAt, now);
    const lastActivityAtMs = parseTimestamp(storedState.lastActivityAt, issuedAtMs);
    const idleTimeoutMs = Number.isFinite(storedState.idleTimeoutMs) ? storedState.idleTimeoutMs : policy.idleTimeoutMs;
    const absoluteTimeoutMs = Number.isFinite(storedState.absoluteTimeoutMs) ? storedState.absoluteTimeoutMs : policy.absoluteTimeoutMs;
    const idleExpiresAtMs = lastActivityAtMs + idleTimeoutMs;
    const absoluteExpiresAtMs = issuedAtMs + absoluteTimeoutMs;
    const supersededByNewLogin = Boolean(
        policy.preventConcurrentLogins
        && userControl.activeSessionId
        && storedState.sessionId
        && userControl.activeSessionId !== storedState.sessionId
    );
    const idleExpired = now >= idleExpiresAtMs;
    const absoluteExpired = now >= absoluteExpiresAtMs;
    const lockReason = supersededByNewLogin
        ? SESSION_LOCK_REASONS.CONCURRENT_LOGIN
        : (absoluteExpired
            ? SESSION_LOCK_REASONS.ABSOLUTE_TIMEOUT
            : (idleExpired ? SESSION_LOCK_REASONS.IDLE_TIMEOUT : SESSION_LOCK_REASONS.NONE));

    return {
        tracked: true,
        valid: lockReason === SESSION_LOCK_REASONS.NONE,
        active: lockReason === SESSION_LOCK_REASONS.NONE,
        sessionId: String(storedState.sessionId || '').trim(),
        userId: String(storedState.userId || '').trim(),
        issuedAt: toIso(issuedAtMs),
        lastActivityAt: toIso(lastActivityAtMs),
        idleExpiresAt: toIso(idleExpiresAtMs),
        absoluteExpiresAt: toIso(absoluteExpiresAtMs),
        idleTimeoutMs,
        absoluteTimeoutMs,
        remainingIdleMs: Math.max(0, idleExpiresAtMs - now),
        remainingAbsoluteMs: Math.max(0, absoluteExpiresAtMs - now),
        networkZone: inferNetworkZone(user, storedState),
        fieldDeployed: policy.fieldDeployed,
        preventConcurrentLogins: policy.preventConcurrentLogins,
        currentActiveSessionId: userControl.activeSessionId,
        supersededByNewLogin,
        lockReason,
        lockReasonDescription: describeLockReason(lockReason)
    };
}

function markSessionCookie(session, state) {
    if (!session || !session.cookie || !state) {
        return;
    }

    session.cookie.maxAge = Math.min(state.idleTimeoutMs, state.remainingAbsoluteMs || state.absoluteTimeoutMs);
}

function saveSession(session) {
    if (!session || typeof session.save !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function persistUserSessionControl(user, sessionControl) {
    if (!user || typeof user !== 'object') {
        return Promise.resolve(null);
    }

    user.sessionControl = {
        ...normalizeUserSessionControl(user),
        ...sessionControl
    };

    if (typeof user.markModified === 'function') {
        user.markModified('sessionControl');
    }

    if (typeof user.save === 'function') {
        return user.save();
    }

    return Promise.resolve(user);
}

async function beginAuthenticatedSession({ user, session, runtimeConfig, now = Date.now() } = {}) {
    if (!session || typeof session !== 'object') {
        throw new Error('Session state is unavailable.');
    }

    const policy = buildSessionPolicy({
        user,
        session,
        runtimeConfig
    });
    const sessionId = `sess-${crypto.randomBytes(8).toString('hex')}`;
    const issuedAt = toIso(now);

    session.sessionManagement = {
        sessionId,
        userId: String(user && (user._id || user.id) ? (user._id || user.id) : '').trim(),
        networkZone: policy.networkZone,
        issuedAt,
        lastActivityAt: issuedAt,
        idleTimeoutMs: policy.idleTimeoutMs,
        absoluteTimeoutMs: policy.absoluteTimeoutMs,
        concurrentLoginPrevention: policy.preventConcurrentLogins,
        lastLockReason: '',
        lastLockAt: ''
    };

    if (policy.preventConcurrentLogins) {
        await persistUserSessionControl(user, {
            activeSessionId: sessionId,
            activeSessionIssuedAt: new Date(now),
            lastLockReason: '',
            lastLockAt: null
        });
    }

    const currentState = buildCurrentSessionState({
        user,
        session,
        runtimeConfig,
        now
    });
    markSessionCookie(session, currentState);
    await saveSession(session);
    return currentState;
}

async function refreshAuthenticatedSession({ user, session, runtimeConfig, now = Date.now() } = {}) {
    if (!session || typeof session !== 'object') {
        throw new Error('Session state is unavailable.');
    }

    const currentState = buildCurrentSessionState({
        user,
        session,
        runtimeConfig,
        now
    });

    if (!currentState.tracked) {
        return beginAuthenticatedSession({
            user,
            session,
            runtimeConfig,
            now
        });
    }

    if (!currentState.valid) {
        return currentState;
    }

    session.sessionManagement = {
        ...session.sessionManagement,
        lastActivityAt: toIso(now),
        networkZone: currentState.networkZone,
        idleTimeoutMs: currentState.idleTimeoutMs,
        absoluteTimeoutMs: currentState.absoluteTimeoutMs
    };

    const refreshedState = buildCurrentSessionState({
        user,
        session,
        runtimeConfig,
        now
    });
    markSessionCookie(session, refreshedState);
    await saveSession(session);
    return refreshedState;
}

async function clearCurrentSessionBinding({ user, session, reason = SESSION_LOCK_REASONS.MANUAL_LOCKDOWN, now = Date.now() } = {}) {
    const currentSessionId = String(session && session.sessionManagement && session.sessionManagement.sessionId
        ? session.sessionManagement.sessionId
        : '').trim();
    const userControl = normalizeUserSessionControl(user);

    if (!currentSessionId || !userControl.activeSessionId || currentSessionId !== userControl.activeSessionId) {
        return false;
    }

    await persistUserSessionControl(user, {
        activeSessionId: '',
        activeSessionIssuedAt: null,
        lastLockReason: reason,
        lastLockAt: new Date(now)
    });

    return true;
}

async function recordSessionLock({ user, session, reason, runtimeConfig, now = Date.now() } = {}) {
    if (session && session.sessionManagement && typeof session.sessionManagement === 'object') {
        session.sessionManagement.lastLockReason = reason;
        session.sessionManagement.lastLockAt = toIso(now);
    }

    if (reason !== SESSION_LOCK_REASONS.CONCURRENT_LOGIN) {
        await clearCurrentSessionBinding({
            user,
            session,
            reason,
            now
        });
    }

    await saveSession(session);

    return buildCurrentSessionState({
        user,
        session,
        runtimeConfig,
        now
    });
}

function getLoginReasonMessage(reason = '') {
    switch (String(reason || '').trim()) {
        case SESSION_LOCK_REASONS.IDLE_TIMEOUT:
            return 'Your session expired after inactivity. Please sign in again.';
        case SESSION_LOCK_REASONS.ABSOLUTE_TIMEOUT:
            return 'Your secure session reached its maximum duration. Please sign in again.';
        case SESSION_LOCK_REASONS.CONCURRENT_LOGIN:
            return 'This session was locked because the account signed in somewhere else.';
        case SESSION_LOCK_REASONS.MANUAL_LOCKDOWN:
            return 'Your session was locked. Please sign in again.';
        default:
            return '';
    }
}

module.exports = {
    SESSION_LOCK_REASONS,
    beginAuthenticatedSession,
    buildCurrentSessionState,
    buildSessionPolicy,
    clearCurrentSessionBinding,
    describeLockReason,
    getLoginReasonMessage,
    normalizeSessionManagementConfig,
    normalizeUserSessionControl,
    recordSessionLock,
    refreshAuthenticatedSession
};
