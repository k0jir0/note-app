const { normalizeUserAccessProfile } = require('./missionAccessControlService');
const {
    SESSION_LOCK_REASONS,
    buildCurrentSessionState,
    buildSessionPolicy
} = require('./sessionManagementService');

const SCENARIO_CATALOG = [
    {
        id: 'abandoned-field-terminal',
        label: 'Abandoned Field Terminal',
        summary: 'A mission-zone terminal is left unattended long enough that the session must lock on inactivity.',
        networkZone: 'mission',
        idleMinutes: 8,
        elapsedHours: 1,
        concurrentLoginDetected: false
    },
    {
        id: 'same-account-second-device',
        label: 'Second Device Login',
        summary: 'The same operator signs in from a second device, so the original session must be invalidated immediately.',
        networkZone: 'corp',
        idleMinutes: 1,
        elapsedHours: 0.25,
        concurrentLoginDetected: true
    },
    {
        id: 'active-headquarters-session',
        label: 'Active Headquarters Session',
        summary: 'A managed corp-zone workstation is still within its idle and absolute limits and remains usable.',
        networkZone: 'corp',
        idleMinutes: 4,
        elapsedHours: 1,
        concurrentLoginDetected: false
    }
];

const CONTROL_GUIDANCE = [
    {
        id: 'idle-timeout',
        label: 'Strict idle timeout',
        description: 'Short inactivity windows reduce the chance that an abandoned field terminal remains usable.'
    },
    {
        id: 'absolute-timeout',
        label: 'Absolute session lifetime',
        description: 'Even an active session eventually expires so elevated access does not persist all day.'
    },
    {
        id: 'single-session',
        label: 'Concurrent login prevention',
        description: 'A newer login revokes the older one so the same account is not active on multiple terminals.'
    },
    {
        id: 'server-side-lockdown',
        label: 'Server-side lockdown',
        description: 'The server invalidates the session itself rather than relying on the browser to close the tab.'
    }
];

function normalizeBaseUrl(baseUrl = '') {
    const value = String(baseUrl || '').trim();
    if (!value) {
        return 'http://localhost:3000';
    }

    return value.replace(/\/+$/, '');
}

function toMinutes(milliseconds) {
    return Math.round(milliseconds / 60000);
}

function toHours(milliseconds) {
    return Number((milliseconds / (60 * 60 * 1000)).toFixed(1));
}

function listSessionManagementScenarios() {
    return SCENARIO_CATALOG.map((scenario) => ({ ...scenario }));
}

function getSessionManagementScenario(scenarioId = '') {
    return listSessionManagementScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

function evaluateSessionLockdownScenario({
    user,
    session,
    runtimeConfig,
    scenarioId,
    idleMinutes,
    elapsedHours,
    networkZone,
    concurrentLoginDetected
} = {}) {
    const scenario = getSessionManagementScenario(scenarioId) || null;
    const selectedNetworkZone = String(networkZone || (scenario ? scenario.networkZone : '') || '').trim().toLowerCase() || 'corp';
    const effectiveUser = {
        ...(user || {}),
        accessProfile: {
            ...(user && user.accessProfile ? user.accessProfile : {}),
            networkZones: [selectedNetworkZone]
        }
    };
    const effectiveSession = {
        ...(session || {}),
        sessionManagement: {
            ...((session && session.sessionManagement && typeof session.sessionManagement === 'object')
                ? session.sessionManagement
                : {}),
            networkZone: selectedNetworkZone
        }
    };
    const policy = buildSessionPolicy({
        user: effectiveUser,
        session: effectiveSession,
        runtimeConfig
    });
    const effectiveIdleMinutes = Number.isFinite(idleMinutes) ? idleMinutes : (scenario ? scenario.idleMinutes : 0);
    const effectiveElapsedHours = Number.isFinite(elapsedHours) ? elapsedHours : (scenario ? scenario.elapsedHours : 0);
    const secondLoginDetected = typeof concurrentLoginDetected === 'boolean'
        ? concurrentLoginDetected
        : Boolean(scenario && scenario.concurrentLoginDetected);
    const idleExceeded = effectiveIdleMinutes * 60 * 1000 >= policy.idleTimeoutMs;
    const absoluteExceeded = effectiveElapsedHours * 60 * 60 * 1000 >= policy.absoluteTimeoutMs;
    const lockReason = secondLoginDetected
        ? SESSION_LOCK_REASONS.CONCURRENT_LOGIN
        : (absoluteExceeded
            ? SESSION_LOCK_REASONS.ABSOLUTE_TIMEOUT
            : (idleExceeded ? SESSION_LOCK_REASONS.IDLE_TIMEOUT : SESSION_LOCK_REASONS.NONE));

    return {
        scenario: scenario || {
            id: 'custom-session-scenario',
            label: 'Custom Session Scenario',
            summary: 'A custom session-evaluation run built from the supplied form values.'
        },
        policy: {
            networkZone: policy.networkZone,
            idleTimeoutMinutes: toMinutes(policy.idleTimeoutMs),
            absoluteTimeoutHours: toHours(policy.absoluteTimeoutMs),
            preventConcurrentLogins: policy.preventConcurrentLogins,
            fieldDeployed: policy.fieldDeployed
        },
        observed: {
            idleMinutes: effectiveIdleMinutes,
            elapsedHours: effectiveElapsedHours,
            concurrentLoginDetected: secondLoginDetected
        },
        decision: lockReason ? 'lock' : 'allow',
        locked: Boolean(lockReason),
        lockReason,
        reasonSummary: lockReason === SESSION_LOCK_REASONS.CONCURRENT_LOGIN
            ? 'A second login was detected, so the original session must be revoked immediately.'
            : (lockReason === SESSION_LOCK_REASONS.ABSOLUTE_TIMEOUT
                ? 'The session exceeded its maximum lifetime and must be terminated.'
                : (lockReason === SESSION_LOCK_REASONS.IDLE_TIMEOUT
                    ? 'The session exceeded the idle timeout and must be terminated.'
                    : 'The session remains within the configured idle and absolute limits.')),
        failedChecks: [
            idleExceeded ? 'idle-timeout' : '',
            absoluteExceeded ? 'absolute-timeout' : '',
            secondLoginDetected ? 'single-session' : ''
        ].filter(Boolean)
    };
}

function buildSessionManagementModuleOverview({ user, session, runtimeConfig, baseUrl } = {}) {
    const currentProfile = normalizeUserAccessProfile(user);
    const currentSession = buildCurrentSessionState({
        user,
        session,
        runtimeConfig
    });
    const policy = buildSessionPolicy({
        user,
        session,
        runtimeConfig
    });
    const scenarios = listSessionManagementScenarios();
    const defaultScenario = scenarios[0];

    return {
        module: {
            name: 'Session Management Module',
            focus: 'Strict timeout and concurrent-login enforcement',
            route: '/session-management/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        currentProfile,
        currentSession,
        policy: {
            networkZone: policy.networkZone,
            fieldDeployed: policy.fieldDeployed,
            idleTimeoutMinutes: toMinutes(policy.idleTimeoutMs),
            absoluteTimeoutHours: toHours(policy.absoluteTimeoutMs),
            preventConcurrentLogins: policy.preventConcurrentLogins
        },
        controls: CONTROL_GUIDANCE.map((control) => ({ ...control })),
        scenarios,
        defaultScenarioId: defaultScenario.id,
        defaultEvaluation: evaluateSessionLockdownScenario({
            user,
            session,
            runtimeConfig,
            scenarioId: defaultScenario.id
        })
    };
}

module.exports = {
    buildSessionManagementModuleOverview,
    evaluateSessionLockdownScenario,
    getSessionManagementScenario,
    listSessionManagementScenarios
};
