const { BREAK_GLASS_MODES, canControlBreakGlass } = require('./breakGlassService');

const MODE_SUMMARIES = {
    [BREAK_GLASS_MODES.DISABLED]: {
        label: 'Disabled',
        description: 'Normal operations are active. Reads and writes are available to authorized users.'
    },
    [BREAK_GLASS_MODES.READ_ONLY]: {
        label: 'Read-Only',
        description: 'Read traffic continues, but all mutating operations are blocked to preserve evidence and data integrity.'
    },
    [BREAK_GLASS_MODES.OFFLINE]: {
        label: 'Offline',
        description: 'Traffic is redirected to the emergency page and API calls receive a 503 response until the incident is contained.'
    }
};

const CONTROL_GUIDANCE = [
    {
        id: 'global-backend-flag',
        label: 'Global backend flag',
        description: 'A single backend-owned state governs whether the app stays live, shifts to read-only, or goes fully offline.'
    },
    {
        id: 'emergency-redirect',
        label: 'Emergency redirect surface',
        description: 'Offline mode sends page traffic to a dedicated emergency page instead of allowing partial access to stale workflows.'
    },
    {
        id: 'write-neutralization',
        label: 'Write neutralization',
        description: 'Read-only mode blocks POST, PUT, PATCH, and DELETE operations so operators can stabilize the app without data loss.'
    },
    {
        id: 'restricted-control-plane',
        label: 'Restricted control plane',
        description: 'Only admin and break_glass mission roles can change the runtime kill-switch state.'
    }
];

function buildModeCatalog() {
    return Object.values(BREAK_GLASS_MODES).map((mode) => ({
        id: mode,
        label: MODE_SUMMARIES[mode].label,
        description: MODE_SUMMARIES[mode].description
    }));
}

function buildBreakGlassModuleOverview({ baseUrl, breakGlass, user } = {}) {
    const state = breakGlass && typeof breakGlass === 'object'
        ? breakGlass
        : {
            mode: BREAK_GLASS_MODES.DISABLED,
            enabled: false,
            readOnly: false,
            offline: false,
            reason: '',
            activatedAt: null,
            activatedBy: ''
        };
    const currentMode = MODE_SUMMARIES[state.mode] || MODE_SUMMARIES[BREAK_GLASS_MODES.DISABLED];
    const operatorCanControl = canControlBreakGlass(user);

    return {
        module: {
            name: 'Break-Glass and Emergency Control Module',
            focus: 'Global incident neutralization, read-only posture, and emergency shutdown controls',
            route: '/break-glass/module',
            baseUrl: String(baseUrl || 'http://localhost:3000').replace(/\/+$/, '')
        },
        state: {
            mode: state.mode,
            enabled: Boolean(state.enabled),
            readOnly: Boolean(state.readOnly),
            offline: Boolean(state.offline),
            label: currentMode.label,
            description: currentMode.description,
            reason: state.reason || '',
            activatedAt: state.activatedAt || null,
            activatedBy: state.activatedBy || ''
        },
        health: {
            endpoint: '/healthz',
            expectedStatus: state.offline ? 503 : 200,
            summary: state.offline
                ? 'Health checks reflect the neutralized state so orchestration and operators can see the app is intentionally offline.'
                : 'Health checks remain available even when the break-glass control changes application behavior.'
        },
        controls: {
            canToggle: operatorCanControl,
            runtimeStatusEndpoint: '/api/runtime/break-glass',
            runtimeToggleEndpoint: '/api/runtime/break-glass',
            allowedModes: buildModeCatalog(),
            safeBypassPaths: ['/healthz', '/emergency', '/api/runtime/break-glass']
        },
        guidance: CONTROL_GUIDANCE.map((item) => ({ ...item }))
    };
}

module.exports = {
    buildBreakGlassModuleOverview,
    buildModeCatalog
};