const DEFAULT_SELENIUM_SCENARIO_ID = 'research-full-suite';

const SELENIUM_SCENARIOS = [
    {
        id: 'auth-login-form',
        title: 'Login Form Smoke',
        purpose: 'Open the login page and verify the core authentication controls remain visible for manual or automated sign-in.',
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
        suiteFile: 'selenium-tests/auth-and-notes.test.js'
    },
    {
        id: 'auth-signup-form',
        title: 'Signup Form Smoke',
        purpose: 'Open the signup page and verify that password guidance and account-creation controls remain available.',
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
        suiteFile: 'selenium-tests/auth-and-notes.test.js'
    },
    {
        id: 'research-selenium-entry-flow',
        title: 'Signup, Login, and Research Entry Flow',
        purpose: 'Create a disposable user, reach the authenticated Notes home, and confirm the Research Workspace remains available from the main product navigation.',
        routes: ['/auth/signup', '/auth/login', '/notes', '/research'],
        assertions: [
            'Disposable signup succeeds',
            'Login redirects to the notes home',
            'Notes home welcomes the authenticated user',
            'Research link is visible after login',
            'Research Workspace heading is visible'
        ],
        tags: ['auth', 'navigation', 'browser'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/auth-and-notes.test.js'
    },
    {
        id: 'notes-crud-workflow',
        title: 'Notes CRUD Workflow',
        purpose: 'Create, view, edit, and delete a note through the server-rendered Notes experience.',
        routes: ['/auth/signup', '/auth/login', '/notes/new', '/notes'],
        assertions: [
            'Create Note form is visible',
            'Note creation redirects to the notes home',
            'Saved note can be viewed and edited',
            'Delete action removes the note from the list'
        ],
        tags: ['notes', 'auth', 'browser'],
        requiresLogin: false,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/auth-and-notes.test.js'
    },
    {
        id: 'workspace-navigation',
        title: 'Research Workspace Navigation',
        purpose: 'Sign in, open the Research Workspace, and confirm that the Security, ML, Selenium, Playwright, Self-Healing, Mission Assurance, Hardware-First MFA, and Session Management entry points remain available.',
        routes: ['/auth/login', '/research'],
        assertions: [
            'Research Workspace heading is visible',
            'Security Module card is present',
            'ML Module card is present',
            'Selenium Module card is present',
            'Playwright Module card is present',
            'Self-Healing Module card is present',
            'Mission Assurance Module card is present',
            'Hardware-First MFA Module card is present',
            'Session Management Module card is present',
            'Workspace navigation buttons open each module'
        ],
        tags: ['smoke', 'auth', 'navigation', 'research'],
        requiresLogin: true,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/research-modules.test.js'
    },
    {
        id: 'security-module-workflow',
        title: 'Security Module Interactive Workflow',
        purpose: 'Load sample log and scan data inside the Security Module, persist the results, and refresh the saved correlation view.',
        routes: ['/security/module'],
        assertions: [
            'Security Module heading is visible',
            'Sample log helper loads log input',
            'Log analysis creates persisted alerts',
            'Sample scan helper loads scan input',
            'Scan importer creates persisted findings',
            'Correlation demo refreshes the correlation view'
        ],
        tags: ['security', 'workspace', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['Redis-backed realtime is optional because this workflow verifies the saved browser-visible security flow.'],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/research-modules.test.js'
    },
    {
        id: 'ml-module-workflow',
        title: 'ML Module Interaction Flow',
        purpose: 'Open the ML Module, refresh the overview, and inject the dry-run autonomy demo so recent scored alerts become visible.',
        routes: ['/ml/module'],
        assertions: [
            'ML Module heading is visible',
            'Observed Autonomous Outcomes panel is visible',
            'Learned Feature Influence panel is visible',
            'Recent Scored Alerts panel is visible',
            'Refresh Module button reloads the ML overview',
            'Autonomy demo injects recent scored alerts'
        ],
        tags: ['ml', 'triage', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['A trained model artifact is optional; the page should still render in heuristic mode.'],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/research-modules.test.js'
    },
    {
        id: 'selenium-module-overview',
        title: 'Selenium Module Overview',
        purpose: 'Open the Selenium Module and confirm that it surfaces scenario coverage, latest suite metadata, and the generated script preview.',
        routes: ['/selenium/module'],
        assertions: [
            'Selenium Module heading is visible',
            'Latest suite run panel is visible',
            'Scenario count is visible',
            'Generated Script Preview panel is visible',
            'Scenario selector is present'
        ],
        tags: ['selenium', 'export', 'browser'],
        requiresLogin: true,
        optionalDependencies: ['A stored Selenium results artifact makes the latest-run panel more informative, but the page still loads without one.'],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/selenium-module.test.js'
    },
    {
        id: 'selenium-script-preview-updates',
        title: 'Selenium Script Preview Updates',
        purpose: 'Switch scenarios inside the Selenium Module and verify that the generated WebDriver template updates to reflect the selected flow.',
        routes: ['/selenium/module'],
        assertions: [
            'Scenario selector updates the generated script',
            'Load Script button refreshes the preview',
            'Security Module script preview references the security route',
            'Research full suite preview references cross-module routes'
        ],
        tags: ['selenium', 'export', 'browser'],
        requiresLogin: true,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/selenium-module.test.js'
    },
    {
        id: 'selenium-module-navigation',
        title: 'Selenium Module Navigation Flow',
        purpose: 'Refresh the Selenium Module and confirm that its cross-module navigation controls still reach the rest of the Research workflow.',
        routes: ['/selenium/module', '/playwright/module'],
        assertions: [
            'Refresh Module button reloads the overview',
            'Playwright Module navigation button remains available',
            'Playwright Module heading loads from Selenium navigation'
        ],
        tags: ['selenium', 'navigation', 'browser'],
        requiresLogin: true,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/selenium-module.test.js'
    },
    {
        id: 'session-management-module-smoke',
        title: 'Session Management Module Smoke',
        purpose: 'Open the Session Management Module and confirm that the live session summary, timeout policy, and lockdown-evaluation controls are visible.',
        routes: ['/session-management/module'],
        assertions: [
            'Session Management Module heading is visible',
            'Live session summary is visible',
            'Lockdown evaluation controls are visible',
            'Scenario selector is present',
            'Lockdown decision panel is visible'
        ],
        tags: ['session-management', 'research', 'browser'],
        requiresLogin: true,
        optionalDependencies: [],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/research-modules.test.js'
    },
    {
        id: 'research-full-suite',
        title: 'Research Workspace Full Suite',
        purpose: 'Run one authenticated Selenium path across Research, Security, ML, Selenium, Playwright, Self-Healing, Session Management, Mission Assurance, and Hardware-First MFA so the end-to-end browser workflow is covered by a single smoke scenario.',
        routes: ['/auth/login', '/research', '/security/module', '/ml/module', '/selenium/module', '/playwright/module', '/self-healing/module', '/session-management/module', '/hardware-mfa/module', '/mission-assurance/module'],
        assertions: [
            'Authentication succeeds with a disposable test user',
            'Research Workspace renders all module entry points',
            'Security Module renders its workflow controls',
            'ML Module renders its autonomy controls',
            'Selenium Module renders latest suite metadata',
            'Playwright Module renders its starter spec preview',
            'Self-Healing Module renders repair suggestions',
            'Session Management Module renders lockdown controls',
            'Hardware-First MFA Module renders step-up controls',
            'Mission Assurance Module renders policy evaluator'
        ],
        tags: ['full-suite', 'research', 'smoke'],
        requiresLogin: true,
        optionalDependencies: [
            'A Redis-backed worker is only needed if you extend the suite to validate realtime connect flow.',
            'The ML page still works in heuristic mode, so a trained model artifact is optional for smoke coverage.'
        ],
        implementedInSuite: true,
        suiteFile: 'selenium-tests/research-modules.test.js'
    }
];

function listSeleniumScenarios() {
    return SELENIUM_SCENARIOS.map((scenario) => ({
        ...scenario,
        routes: [...scenario.routes],
        assertions: [...scenario.assertions],
        tags: [...scenario.tags],
        optionalDependencies: [...scenario.optionalDependencies]
    }));
}

function getSeleniumScenario(scenarioId = DEFAULT_SELENIUM_SCENARIO_ID) {
    return listSeleniumScenarios().find((scenario) => scenario.id === scenarioId) || null;
}

module.exports = {
    DEFAULT_SELENIUM_SCENARIO_ID,
    getSeleniumScenario,
    listSeleniumScenarios
};
