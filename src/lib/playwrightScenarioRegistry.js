const DEFAULT_PLAYWRIGHT_SCENARIO_ID = 'research-full-suite';

const PLAYWRIGHT_SCENARIOS = [
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
