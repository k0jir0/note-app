const noteApiRoutes = require('../routes/noteApiRoutes');
const securityApiRoutes = require('../routes/securityApiRoutes');
const mlApiRoutes = require('../routes/mlApiRoutes');
const playwrightApiRoutes = require('../routes/playwrightApiRoutes');
const injectionPreventionApiRoutes = require('../routes/injectionPreventionApiRoutes');
const xssDefenseApiRoutes = require('../routes/xssDefenseApiRoutes');
const locatorRepairApiRoutes = require('../routes/locatorRepairApiRoutes');
const hardwareFirstMfaApiRoutes = require('../routes/hardwareFirstMfaApiRoutes');
const missionAssuranceApiRoutes = require('../routes/missionAssuranceApiRoutes');
const sessionManagementApiRoutes = require('../routes/sessionManagementApiRoutes');
const seleniumApiRoutes = require('../routes/seleniumApiRoutes');
const scanApiRoutes = require('../routes/scanApiRoutes');
const devRuntimeRoutes = require('../routes/devRuntimeRoutes');
const { requireAuthAPI } = require('../middleware/auth');
const {
    isProtectedApiPath,
    listProtectedApiPathPrefixes,
    listProtectedApiPaths,
    listPublicApiPaths,
    normalizeAccessPath
} = require('./apiAccessControlService');
const { normalizeUserAccessProfile } = require('./missionAccessControlService');

const ROUTER_CATALOG = [
    { source: 'src/routes/noteApiRoutes.js', router: noteApiRoutes, family: 'notes' },
    { source: 'src/routes/securityApiRoutes.js', router: securityApiRoutes, family: 'security' },
    { source: 'src/routes/mlApiRoutes.js', router: mlApiRoutes, family: 'ml' },
    { source: 'src/routes/playwrightApiRoutes.js', router: playwrightApiRoutes, family: 'playwright' },
    { source: 'src/routes/injectionPreventionApiRoutes.js', router: injectionPreventionApiRoutes, family: 'injection-prevention' },
    { source: 'src/routes/xssDefenseApiRoutes.js', router: xssDefenseApiRoutes, family: 'xss-defense' },
    { source: 'src/routes/locatorRepairApiRoutes.js', router: locatorRepairApiRoutes, family: 'self-healing' },
    { source: 'src/routes/hardwareFirstMfaApiRoutes.js', router: hardwareFirstMfaApiRoutes, family: 'hardware-mfa' },
    { source: 'src/routes/missionAssuranceApiRoutes.js', router: missionAssuranceApiRoutes, family: 'mission-assurance' },
    { source: 'src/routes/sessionManagementApiRoutes.js', router: sessionManagementApiRoutes, family: 'session-management' },
    { source: 'src/routes/seleniumApiRoutes.js', router: seleniumApiRoutes, family: 'selenium' },
    { source: 'src/routes/scanApiRoutes.js', router: scanApiRoutes, family: 'scans' },
    { source: 'src/routes/devRuntimeRoutes.js', router: devRuntimeRoutes, family: 'runtime' }
];

const STATIC_ROUTE_DEFINITIONS = [
    {
        family: 'access-control',
        source: 'src/routes/accessControlApiRoutes.js',
        method: 'GET',
        path: '/api/access-control/overview',
        middlewareNames: ['requireAuthAPI', 'missionAccessApiMiddleware', 'getOverview'],
        protectedByDefault: true,
        hasRouteLevelAuth: true,
        missionPolicyEnabled: true,
        rateLimited: false,
        serverVerification: 'global + route-level'
    },
    {
        family: 'access-control',
        source: 'src/routes/accessControlApiRoutes.js',
        method: 'POST',
        path: '/api/access-control/evaluate',
        middlewareNames: ['requireAuthAPI', 'missionAccessApiMiddleware', 'evaluateScenario'],
        protectedByDefault: true,
        hasRouteLevelAuth: true,
        missionPolicyEnabled: true,
        rateLimited: false,
        serverVerification: 'global + route-level'
    }
];

const CONTROL_GUIDANCE = [
    {
        id: 'global-api-gate',
        label: 'Global API identity gate',
        description: 'Every protected API path is denied by default unless the server sees an authenticated user object with a stable _id.'
    },
    {
        id: 'route-level-auth-checks',
        label: 'Route-level auth middleware',
        description: 'Individual API routers still keep requireAuthAPI in place so route definitions remain explicit and self-documenting.'
    },
    {
        id: 'ownership-scoping',
        label: 'Ownership scoping',
        description: 'Resource controllers use req.user._id server-side so a user cannot pivot into another user\'s records by editing URLs or request bodies.'
    },
    {
        id: 'mission-policy-layer',
        label: 'Mission policy layer',
        description: 'Sensitive API routes add mission and role checks on top of identity so visibility in the frontend never implies server permission.'
    },
    {
        id: 'public-exception-list',
        label: 'Explicit public exception list',
        description: 'Only named public exceptions such as the test CSRF helper bypass the global API access gate.'
    }
];

const SAMPLE_SCENARIOS = [
    {
        id: 'unauthenticated-notes-api',
        label: 'Unauthenticated Notes API Probe',
        summary: 'An attacker calls the Notes API directly without a valid server-side session.',
        method: 'GET',
        routePath: '/api/notes',
        defaults: {
            authenticated: false,
            serverIdentityVerified: false,
            ownsResource: false,
            missionRole: 'analyst',
            frontendVisible: true
        },
        checks: ['global-api-gate'],
        allowRoles: []
    },
    {
        id: 'cross-user-note-access',
        label: 'Cross-User Note Access Attempt',
        summary: 'A logged-in user tries to read another user\'s note by changing the note identifier in the request path.',
        method: 'GET',
        routePath: '/api/notes/:id',
        defaults: {
            authenticated: true,
            serverIdentityVerified: true,
            ownsResource: false,
            missionRole: 'analyst',
            frontendVisible: false
        },
        checks: ['global-api-gate', 'resource-ownership'],
        allowRoles: []
    },
    {
        id: 'analyst-ml-train-attempt',
        label: 'Analyst ML Training Attempt',
        summary: 'A normal analyst forces a POST to the ML training endpoint even if a privileged button was hidden in the UI.',
        method: 'POST',
        routePath: '/api/ml/train',
        defaults: {
            authenticated: true,
            serverIdentityVerified: true,
            ownsResource: true,
            missionRole: 'analyst',
            frontendVisible: true
        },
        checks: ['global-api-gate', 'mission-policy'],
        allowRoles: ['mission_lead', 'admin', 'break_glass']
    },
    {
        id: 'owned-note-update',
        label: 'Owned Note Update',
        summary: 'An authenticated user updates their own note through the API with a valid server-side identity.',
        method: 'PUT',
        routePath: '/api/notes/:id',
        defaults: {
            authenticated: true,
            serverIdentityVerified: true,
            ownsResource: true,
            missionRole: 'analyst',
            frontendVisible: true
        },
        checks: ['global-api-gate', 'resource-ownership'],
        allowRoles: []
    }
];

function normalizeBaseUrl(baseUrl = '') {
    const value = String(baseUrl || '').trim();
    return value ? value.replace(/\/+$/, '') : 'http://localhost:3000';
}

function extractProtectedRoutes() {
    return ROUTER_CATALOG.flatMap(({ source, router, family }) => router.stack
        .filter((layer) => layer.route)
        .flatMap((layer) => {
            const routePath = normalizeAccessPath(layer.route.path || '');

            if (!isProtectedApiPath(routePath)) {
                return [];
            }

            const middlewareNames = layer.route.stack.map((entry) => {
                if (entry.handle === requireAuthAPI) {
                    return 'requireAuthAPI';
                }

                return entry.name || (entry.handle && entry.handle.name) || 'anonymous';
            });
            const hasRouteLevelAuth = middlewareNames.includes('requireAuthAPI');
            const missionPolicyEnabled = middlewareNames.includes('missionAccessApiMiddleware');
            const rateLimited = middlewareNames.some((name) => name.toLowerCase().includes('rate'));

            return Object.keys(layer.route.methods)
                .filter((method) => layer.route.methods[method])
                .map((method) => ({
                    family,
                    source,
                    method: method.toUpperCase(),
                    path: routePath,
                    middlewareNames,
                    protectedByDefault: true,
                    hasRouteLevelAuth,
                    missionPolicyEnabled,
                    rateLimited,
                    serverVerification: hasRouteLevelAuth ? 'global + route-level' : 'global gate'
                }));
        }))
        .concat(STATIC_ROUTE_DEFINITIONS.map((route) => ({ ...route })))
        .sort((left, right) => {
            if (left.path === right.path) {
                return left.method.localeCompare(right.method);
            }

            return left.path.localeCompare(right.path);
        });
}

function listAccessControlScenarios() {
    return SAMPLE_SCENARIOS.map((scenario) => ({
        ...scenario,
        defaults: { ...scenario.defaults },
        checks: [...scenario.checks],
        allowRoles: [...scenario.allowRoles]
    }));
}

function getAccessControlScenario(scenarioId = '') {
    return listAccessControlScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

function findRouteDefinition(method = 'GET', routePath = '') {
    const normalizedPath = normalizeAccessPath(routePath);
    return extractProtectedRoutes().find((route) => route.method === String(method).toUpperCase() && route.path === normalizedPath) || null;
}

function evaluateAccessControlScenario({
    scenarioId,
    authenticated,
    serverIdentityVerified,
    ownsResource,
    missionRole,
    frontendVisible
} = {}) {
    const scenario = getAccessControlScenario(scenarioId) || listAccessControlScenarios()[0];
    const context = {
        authenticated: authenticated ?? scenario.defaults.authenticated,
        serverIdentityVerified: serverIdentityVerified ?? scenario.defaults.serverIdentityVerified,
        ownsResource: ownsResource ?? scenario.defaults.ownsResource,
        missionRole: String(missionRole || scenario.defaults.missionRole || 'analyst').trim().toLowerCase(),
        frontendVisible: frontendVisible ?? scenario.defaults.frontendVisible
    };
    const routeDefinition = findRouteDefinition(scenario.method, scenario.routePath);
    const failedChecks = [];
    let allowed = true;
    let httpStatus = 200;
    let decision = 'allow';
    let summary = 'Server-side access control allows the request.';

    if (!context.authenticated || !context.serverIdentityVerified) {
        allowed = false;
        httpStatus = 401;
        decision = 'deny-unauthenticated';
        summary = 'Blocked by the global API access-control gate before the controller runs.';
        failedChecks.push('server-identity');
    } else if (scenario.checks.includes('resource-ownership') && !context.ownsResource) {
        allowed = false;
        httpStatus = 404;
        decision = 'deny-resource-scope';
        summary = 'The request reaches the server as an authenticated user, but ownership scoping prevents cross-user access.';
        failedChecks.push('resource-ownership');
    } else if (scenario.allowRoles.length && !scenario.allowRoles.includes(context.missionRole)) {
        allowed = false;
        httpStatus = 403;
        decision = 'deny-policy';
        summary = 'The request is authenticated, but the server-side policy layer denies it for the current mission role.';
        failedChecks.push('mission-policy');
    }

    return {
        scenario,
        route: routeDefinition || {
            method: scenario.method,
            path: scenario.routePath,
            protectedByDefault: isProtectedApiPath(scenario.routePath),
            hasRouteLevelAuth: false,
            missionPolicyEnabled: false,
            serverVerification: 'global gate'
        },
        context,
        allowed,
        httpStatus,
        decision,
        failedChecks,
        frontendIndependent: true,
        summary,
        explanation: context.frontendVisible
            ? 'Even if the frontend still shows a control, the server makes the final access decision.'
            : 'Even when the frontend hides the control, the server still re-verifies identity and scope.'
    };
}

function buildCurrentIdentitySummary(user) {
    if (!user) {
        return {
            authenticated: false,
            displayName: 'Anonymous request',
            missionRole: 'none',
            clearance: 'none',
            userId: ''
        };
    }

    const profile = normalizeUserAccessProfile(user);
    return {
        authenticated: true,
        displayName: profile.displayName,
        missionRole: profile.missionRole,
        clearance: profile.clearance,
        userId: profile.id,
        networkZones: [...profile.networkZones]
    };
}

function buildAccessControlModuleOverview({ baseUrl, user } = {}) {
    const routes = extractProtectedRoutes();
    const defaultScenario = listAccessControlScenarios()[0];

    return {
        module: {
            name: 'Access Control Module',
            focus: 'Server-side identity verification and broken-access-control prevention',
            route: '/access-control/module',
            baseUrl: normalizeBaseUrl(baseUrl)
        },
        guard: {
            protectedPrefixes: listProtectedApiPathPrefixes(),
            protectedPaths: listProtectedApiPaths(),
            publicExceptions: listPublicApiPaths()
        },
        identity: buildCurrentIdentitySummary(user),
        coverage: {
            protectedRouteCount: routes.length,
            routeLevelAuthCount: routes.filter((route) => route.hasRouteLevelAuth).length,
            missionScopedRouteCount: routes.filter((route) => route.missionPolicyEnabled).length,
            publicExceptionCount: listPublicApiPaths().length
        },
        controls: CONTROL_GUIDANCE.map((control) => ({ ...control })),
        routeCatalog: routes,
        scenarios: listAccessControlScenarios(),
        defaultScenarioId: defaultScenario.id,
        defaultEvaluation: evaluateAccessControlScenario({
            scenarioId: defaultScenario.id
        })
    };
}

module.exports = {
    buildAccessControlModuleOverview,
    evaluateAccessControlScenario,
    extractProtectedRoutes,
    getAccessControlScenario,
    listAccessControlScenarios
};
