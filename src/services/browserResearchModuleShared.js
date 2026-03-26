const DEFAULT_BASE_URL = 'http://localhost:3000';

const COMMON_ROUTE_DESCRIPTIONS = {
    '/auth/login': 'Starts at the login form so the suite can establish an authenticated session before protected routes load.',
    '/auth/signup': 'Opens the signup form so the suite can verify account-creation guidance or create a disposable user.',
    '/notes': 'Loads the authenticated Notes home so the suite can verify the primary post-login workspace.',
    '/notes/new': 'Opens the server-rendered note creation form for CRUD browser coverage.',
    '/research': 'Opens the Research Workspace, the hub for the Security, ML, Selenium, Playwright, and Self-Healing modules.',
    '/security/module': 'Opens the Security Module so the suite can verify analysis, scan import, correlation, and automation controls.',
    '/ml/module': 'Opens the ML Module so the suite can verify training, autonomy, and explainability panels.',
    '/selenium/module': 'Opens the Selenium Module so the suite can verify the Selenium export surface and latest-run metadata.',
    '/playwright/module': 'Opens the Playwright Module so the suite can verify the Playwright export surface.',
    '/self-healing/module': 'Opens the Self-Healing Module so the suite can verify ML-assisted repair suggestions and runtime self-heal guidance.'
};

const COMMON_ASSERTION_DESCRIPTIONS = {
    'Login page heading is visible': 'Checks that the login screen still renders its main heading.',
    'Login form is visible': 'Checks that the login form is present and ready for credential input.',
    'Email and password inputs render': 'Checks that the expected credential fields are still available.',
    'Login page links to sign up': 'Checks that a new user can still navigate from login to account creation.',
    'Signup page heading is visible': 'Checks that the signup screen still renders its main heading.',
    'Signup form is visible': 'Checks that the signup form is present and ready for account creation.',
    'Password requirements guidance is visible': 'Checks that the signup page still explains the password rules to the user.',
    'Signup page links back to login': 'Checks that a returning user can still navigate back to login.',
    'Disposable signup succeeds': 'Checks that the suite can create a disposable account instead of relying on seeded credentials.',
    'Login redirects to the notes home': 'Checks that authentication lands on the Notes home successfully.',
    'Authenticated notes navigation is visible': 'Checks that the signed-in Notes screen exposes the main authenticated navigation.',
    'Notes home welcomes the authenticated user': 'Checks that the Notes page reflects the signed-in user after login.',
    'Research link is visible after login': 'Checks that the Notes home still exposes the Research entry point.',
    'Login form is reachable': 'Checks that the auth entry point loads so the suite can start from a known state.',
    'Research Workspace heading is visible': 'Confirms that navigation reached the Research Workspace.',
    'Security Module card is present': 'Checks that the Research page still links to the Security Module.',
    'ML Module card is present': 'Checks that the Research page still links to the ML Module.',
    'Selenium Module card is present': 'Checks that the Research page still links to the Selenium Module.',
    'Playwright Module card is present': 'Checks that the Research page still links to the Playwright Module.',
    'Self-Healing Module card is present': 'Checks that the Research page still links to the Self-Healing Module.',
    'Create Note form is visible': 'Checks that the note creation form renders with its expected controls.',
    'Note creation redirects to the notes home': 'Checks that creating a note returns the browser to the Notes list.',
    'Saved note can be viewed and edited': 'Checks that a created note can be opened and updated through the HTML flow.',
    'Delete action removes the note from the list': 'Checks that the browser delete action removes the saved note from the list.',
    'Security Module heading is visible': 'Confirms that navigation reached the Security Module.',
    'Refresh Module button is present': 'Checks that the main refresh control is visible.',
    'Log Analysis section is visible': 'Checks that the log analysis tools are visible.',
    'Scan Importer section is visible': 'Checks that the scan import tools are visible.',
    'Sample log helper loads log input': 'Checks that the sample log helper populates the Security Module input.',
    'Log analysis creates persisted alerts': 'Checks that log analysis creates saved alerts and refreshes the findings view.',
    'Sample scan helper loads scan input': 'Checks that the sample scan helper populates the importer input.',
    'Scan importer creates persisted findings': 'Checks that scan import creates saved findings and refreshes the scans view.',
    'Correlation demo refreshes the correlation view': 'Checks that the correlation demo creates saved matches and updates the correlation panel.',
    'ML Module heading is visible': 'Confirms that navigation reached the ML Module.',
    'Observed Autonomous Outcomes panel is visible': 'Checks that the autonomy outcomes panel is visible.',
    'Learned Feature Influence panel is visible': 'Checks that the feature influence panel is visible.',
    'Recent Scored Alerts panel is visible': 'Checks that the recent scored alerts panel is visible.',
    'Authentication succeeds with a disposable test user': 'Checks that the suite can establish an authenticated session before protected routes load.',
    'Research Workspace renders all module entry points': 'Checks that the workspace still exposes the expected module entry points.',
    'Self-Healing Module heading is visible': 'Confirms that navigation reached the Self-Healing Module.',
    'Self-Healing Module renders repair suggestions': 'Confirms that the Self-Healing page still renders sample-driven repair suggestions.'
};

const COMMON_TAG_DESCRIPTIONS = {
    smoke: 'Fast regression check for route and page-shell stability.',
    auth: 'Includes authentication entry points or protected-route setup.',
    browser: 'Uses browser-visible checks such as headings, panels, and controls.',
    navigation: 'Focuses on reaching the right pages through stable paths.',
    notes: 'Covers the server-rendered Notes workspace and CRUD flow.',
    research: 'Anchored in the product\'s cross-module research workflow.',
    security: 'Covers the Security Module and related workflow surfaces.',
    workspace: 'Targets a dedicated research workspace or module page.',
    ml: 'Targets the ML-assisted triage and autonomy surfaces.',
    triage: 'Focuses on scoring, review, or autonomy-related UI.',
    export: 'Focuses on generated automation artifacts.',
    'full-suite': 'Covers the broadest path across multiple product modules.'
};

function normalizeBaseUrl(baseUrl) {
    const normalized = typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim()
        : DEFAULT_BASE_URL;

    return normalized.replace(/\/+$/, '');
}

function buildControlGuide(controlDefinitions = []) {
    return controlDefinitions.map((control) => ({
        id: control.id,
        label: control.label,
        description: control.description,
        interaction: control.interaction
    }));
}

function buildCoverageSummary(scenarios = []) {
    return {
        scenarioCount: scenarios.length,
        authenticatedScenarioCount: scenarios.filter((scenario) => scenario.requiresLogin).length,
        optionalDependencyCount: scenarios.reduce(
            (count, scenario) => count + scenario.optionalDependencies.length,
            0
        )
    };
}

function buildScenarioCatalog({
    baseUrl,
    listScenarios,
    describeRoutePath,
    describeAssertion,
    describeTag,
    buildScenarioFunctionDescription
} = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarios = typeof listScenarios === 'function' ? listScenarios() : [];

    return scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        purpose: scenario.purpose,
        routePaths: [...scenario.routes],
        routes: scenario.routes.map((routePath) => `${normalizedBaseUrl}${routePath}`),
        assertions: [...scenario.assertions],
        assertionDetails: scenario.assertions.map((assertion) => ({
            label: assertion,
            description: describeAssertion(assertion)
        })),
        tags: [...scenario.tags],
        tagDetails: scenario.tags.map((tag) => ({
            label: tag,
            description: describeTag(tag)
        })),
        requiresLogin: scenario.requiresLogin,
        optionalDependencies: [...scenario.optionalDependencies],
        implementedInSuite: Boolean(scenario.implementedInSuite),
        suiteFile: scenario.suiteFile || '',
        routeTargets: scenario.routes.map((routePath) => ({
            path: routePath,
            url: `${normalizedBaseUrl}${routePath}`,
            description: describeRoutePath(routePath)
        })),
        functionDescription: buildScenarioFunctionDescription(scenario)
    }));
}

function collectSuiteFiles(listScenarios) {
    return Array.from(new Set(
        (typeof listScenarios === 'function' ? listScenarios() : [])
            .map((scenario) => scenario.suiteFile)
            .filter((suiteFile) => typeof suiteFile === 'string' && suiteFile.trim())
    ));
}

function buildScriptMetadata({
    baseUrl,
    scenario,
    describeRoutePath,
    describeAssertion,
    describeTag,
    usageNotes = [],
    buildScenarioFunctionDescription,
    content,
    extra = {}
} = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    return {
        scenarioId: scenario.id,
        title: scenario.title,
        purpose: scenario.purpose,
        requiresLogin: scenario.requiresLogin,
        routePaths: [...scenario.routes],
        routeTargets: scenario.routes.map((routePath) => ({
            path: routePath,
            url: `${normalizedBaseUrl}${routePath}`,
            description: describeRoutePath(routePath)
        })),
        assertionDetails: scenario.assertions.map((assertion) => ({
            label: assertion,
            description: describeAssertion(assertion)
        })),
        tagDetails: scenario.tags.map((tag) => ({
            label: tag,
            description: describeTag(tag)
        })),
        usageNotes,
        functionDescription: buildScenarioFunctionDescription(scenario),
        content,
        ...extra
    };
}

module.exports = {
    COMMON_ASSERTION_DESCRIPTIONS,
    COMMON_ROUTE_DESCRIPTIONS,
    COMMON_TAG_DESCRIPTIONS,
    DEFAULT_BASE_URL,
    buildControlGuide,
    buildCoverageSummary,
    buildScenarioCatalog,
    buildScriptMetadata,
    collectSuiteFiles,
    normalizeBaseUrl
};
