const DEFAULT_PLAYWRIGHT_SCENARIO_ID = 'research-full-suite';

const PLAYWRIGHT_SCENARIOS = [
    {
        id: 'auth-login-form',
        title: 'Login Form Smoke',
        purpose: 'Open the login page and verify the core authentication form controls remain available.',
        routes: ['/auth/login'],
        assertions: [
            'Login page heading is visible',
            'Login form is visible',
            'Email and password inputs render',
            'Login page links to sign up'
        ],
        tags: ['smoke', 'auth', 'browser'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/auth-login.spec.js'
    },
    {
        id: 'auth-signup-form',
        title: 'Signup Form Smoke',
        purpose: 'Open the signup page and verify password guidance and account-creation controls remain available.',
        routes: ['/auth/signup'],
        assertions: [
            'Signup page heading is visible',
            'Signup form is visible',
            'Password requirements guidance is visible',
            'Signup page links back to login'
        ],
        tags: ['smoke', 'auth', 'browser'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/auth-login.spec.js'
    },
    {
        id: 'auth-signup-login-flow',
        title: 'Signup And Login Flow',
        purpose: 'Create a disposable user, sign in, and confirm the authenticated Notes home is usable.',
        routes: ['/auth/signup', '/auth/login', '/notes'],
        assertions: [
            'Disposable signup succeeds',
            'Login redirects to the notes home',
            'Authenticated notes navigation is visible'
        ],
        tags: ['auth', 'navigation', 'browser'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/auth-login.spec.js'
    },
    {
        id: 'research-playwright-entry-flow',
        title: 'Research To Playwright Entry Flow',
        purpose: 'Sign in, reach the Research Workspace, and open the Playwright Module through the product navigation.',
        routes: ['/auth/login', '/research', '/playwright/module'],
        assertions: [
            'Research workspace heading is visible',
            'Playwright module card is present',
            'Playwright module loads from the workspace entry point'
        ],
        tags: ['auth', 'navigation', 'playwright'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/auth-login.spec.js'
    },
    {
        id: 'workspace-navigation',
        title: 'Research Workspace Navigation',
        purpose: 'Sign in, open the Research Workspace, and confirm that the Security, ML, Selenium, and Playwright entry points are visible.',
        routes: ['/auth/login', '/research'],
        assertions: [
            'Login form is reachable',
            'Research Workspace heading is visible',
            'Security Module card is present',
            'ML Module card is present',
            'Selenium Module card is present',
            'Playwright Module card is present'
        ],
        tags: ['smoke', 'auth', 'navigation'],
        requiresLogin: true,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    },
    {
        id: 'security-module-smoke',
        title: 'Security Module Smoke',
        purpose: 'Open the Security Module and confirm that its primary analysis, scan, and realtime controls are visible.',
        routes: ['/security/module'],
        assertions: [
            'Security Module heading is visible',
            'Refresh Module button is present',
            'Realtime server badge is visible',
            'Log Analysis section is visible',
            'Scan Importer section is visible'
        ],
        tags: ['security', 'workspace', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['Redis-backed realtime is only needed if you extend the suite with live-stream checks.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    },
    {
        id: 'ml-module-smoke',
        title: 'ML Module Smoke',
        purpose: 'Open the ML Module and confirm that its training, scoring, and review panels are visible.',
        routes: ['/ml/module'],
        assertions: [
            'ML Module heading is visible',
            'Train Hybrid Model button is present',
            'Observed Autonomous Outcomes panel is visible',
            'Learned Feature Influence panel is visible',
            'Recent Scored Alerts panel is visible'
        ],
        tags: ['ml', 'triage', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['A trained model artifact is optional. The page should still render in heuristic mode.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    },
    {
        id: 'selenium-module-smoke',
        title: 'Selenium Module Smoke',
        purpose: 'Open the Selenium Module and confirm that its scenario metadata and script preview are visible.',
        routes: ['/selenium/module'],
        assertions: [
            'Selenium Module heading is visible',
            'Scenario Catalog panel is visible',
            'Generated Script Preview panel is visible',
            'Scenario selector is present',
            'Browser prerequisites render'
        ],
        tags: ['selenium', 'export', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['No local Selenium driver is needed to inspect the generated script inside the app.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    },
    {
        id: 'playwright-module-smoke',
        title: 'Playwright Module Smoke',
        purpose: 'Open the Playwright Module and confirm that its scenario metadata and spec preview are visible.',
        routes: ['/playwright/module'],
        assertions: [
            'Playwright Module heading is visible',
            'Scenario Catalog panel is visible',
            'Generated Spec Preview panel is visible',
            'Scenario selector is present',
            'Playwright prerequisites render'
        ],
        tags: ['playwright', 'export', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['No local Playwright browser install is needed to inspect the generated spec inside the app.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    },
    {
        id: 'notes-crud-workflow',
        title: 'Notes CRUD Workflow',
        purpose: 'Create, view, edit, and delete a note through the server-rendered HTML flow.',
        routes: ['/auth/login', '/notes/new', '/notes'],
        assertions: [
            'Create Note form is visible',
            'Note creation redirects to the notes home',
            'Saved note can be viewed and edited',
            'Delete action removes the note from the list'
        ],
        tags: ['auth', 'browser', 'navigation'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/notes-crud.spec.js'
    },
    {
        id: 'security-module-workflow',
        title: 'Security Module Interactive Workflow',
        purpose: 'Use the Security Module helpers to load sample data, analyze logs, import a scan, and refresh persisted correlations.',
        routes: ['/security/module'],
        assertions: [
            'Sample log helper loads log input',
            'Log analysis creates persisted alerts',
            'Sample scan helper loads scan input',
            'Scan importer creates persisted findings',
            'Correlation demo refreshes the correlation view'
        ],
        tags: ['security', 'workspace', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['Redis is optional because this workflow only verifies the saved browser-visible security flow.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/module-interactions.spec.js'
    },
    {
        id: 'playwright-module-interactions',
        title: 'Playwright Module Interaction Flow',
        purpose: 'Switch scenarios inside the Playwright Module, refresh the overview, and confirm cross-module navigation remains wired.',
        routes: ['/playwright/module', '/security/module'],
        assertions: [
            'Scenario selector updates the generated spec',
            'Load Spec button refreshes the preview',
            'Refresh Module button reloads the overview',
            'Cross-module navigation buttons remain available'
        ],
        tags: ['playwright', 'browser', 'export'],
        requiresLogin: true,
        optionalDependencies: ['A stored Playwright JSON report is optional. The module interactions still work without one.'],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/module-interactions.spec.js'
    },
    {
        id: 'research-full-suite',
        title: 'Research Workspace Full Suite',
        purpose: 'Run one authenticated smoke path across Research, Security, ML, Selenium, and Playwright to validate the end-to-end workspace flow.',
        routes: ['/auth/login', '/research', '/security/module', '/ml/module', '/selenium/module', '/playwright/module'],
        assertions: [
            'Authentication succeeds with a disposable test user',
            'Research Workspace renders all module entry points',
            'Security Module renders its main controls',
            'ML Module renders training and autonomy panels',
            'Selenium Module renders a script preview',
            'Playwright Module renders a spec preview'
        ],
        tags: ['full-suite', 'research', 'smoke'],
        requiresLogin: true,
        optionalDependencies: [
            'A Redis-backed worker is only needed if you extend the suite to validate realtime connect flow.',
            'Use a seeded or disposable account for stable smoke expectations.'
        ],
        implementedInSuite: true,
        suiteFile: 'playwright-tests/research-scenarios.spec.js'
    }
];

function listPlaywrightScenarios() {
    return PLAYWRIGHT_SCENARIOS.map((scenario) => ({
        ...scenario,
        routes: [...scenario.routes],
        assertions: [...scenario.assertions],
        tags: [...scenario.tags],
        optionalDependencies: [...scenario.optionalDependencies]
    }));
}

function getPlaywrightScenario(scenarioId = DEFAULT_PLAYWRIGHT_SCENARIO_ID) {
    return listPlaywrightScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

module.exports = {
    DEFAULT_PLAYWRIGHT_SCENARIO_ID,
    getPlaywrightScenario,
    listPlaywrightScenarios
};
