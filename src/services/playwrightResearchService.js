const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SCENARIO_ID = 'research-full-suite';
const DEFAULT_ROUTE_DESCRIPTION = 'Visits this route directly so the smoke spec can verify the page without relying on brittle click paths.';
const DEFAULT_ASSERTION_DESCRIPTION = 'Checks for stable UI text or controls before deeper automation is added.';

const SCENARIO_DEFINITIONS = [
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
        optionalDependencies: []
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
        optionalDependencies: ['Redis-backed realtime is only needed if you extend the suite with live-stream checks.']
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
        optionalDependencies: ['A trained model artifact is optional. The page should still render in heuristic mode.']
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
        optionalDependencies: ['No local Selenium driver is needed to inspect the generated script inside the app.']
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
        optionalDependencies: ['No local Playwright browser install is needed to inspect the generated spec inside the app.']
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
        ]
    }
];

const CONTROL_DEFINITIONS = [
    {
        id: 'playwright-scenario-select',
        label: 'Scenario selector',
        description: 'Chooses the scenario shown in the summary and export preview.',
        interaction: 'Use it to switch between single-module checks and the full workspace suite.'
    },
    {
        id: 'playwright-refresh-btn',
        label: 'Refresh Module',
        description: 'Reloads the module overview from the server.',
        interaction: 'Use it after restarting the app or changing scenario definitions.'
    },
    {
        id: 'playwright-load-script-btn',
        label: 'Load Spec',
        description: 'Loads the Playwright starter spec for the selected scenario.',
        interaction: 'Use it to inspect one scenario before exporting it.'
    },
    {
        id: 'playwright-copy-script-btn',
        label: 'Copy Spec',
        description: 'Copies the current spec preview to the clipboard.',
        interaction: 'Use it after the preview matches the flow you want to automate.'
    }
];

const ROUTE_DESCRIPTIONS = {
    '/auth/login': 'Starts at the login form so the suite can create an authenticated session before protected routes.',
    '/research': 'Opens the Research Workspace, the hub for the Security, ML, Selenium, and Playwright modules.',
    '/security/module': 'Opens the Security Module so the spec can verify analysis, scan, correlation, and realtime controls.',
    '/ml/module': 'Opens the ML Module so the spec can verify training, scoring, explainability, and autonomy panels.',
    '/selenium/module': 'Opens the Selenium Module so the suite can verify the Selenium export surface.',
    '/playwright/module': 'Opens the Playwright Module so the suite can verify the Playwright export surface.'
};

const ASSERTION_DESCRIPTIONS = {
    'Login form is reachable': 'Checks that the auth entry point loads so the suite can start from a known state.',
    'Research Workspace heading is visible': 'Confirms that the workspace rendered after sign-in.',
    'Security Module card is present': 'Checks that the Research page still links to the Security module.',
    'ML Module card is present': 'Checks that the Research page still links to the ML module.',
    'Selenium Module card is present': 'Checks that the Research page still links to the Selenium module.',
    'Playwright Module card is present': 'Checks that the Research page still links to the Playwright module.',
    'Security Module heading is visible': 'Confirms that navigation reached the Security module.',
    'Refresh Module button is present': 'Checks that the main refresh control is visible.',
    'Realtime server badge is visible': 'Checks that realtime availability is still surfaced in the UI.',
    'Log Analysis section is visible': 'Checks that the log analysis tools are visible.',
    'Scan Importer section is visible': 'Checks that the scan import tools are visible.',
    'ML Module heading is visible': 'Confirms that navigation reached the ML module.',
    'Train Hybrid Model button is present': 'Checks that the primary training action is visible.',
    'Observed Autonomous Outcomes panel is visible': 'Checks that the autonomy outcomes panel is visible.',
    'Learned Feature Influence panel is visible': 'Checks that the feature influence panel is visible.',
    'Recent Scored Alerts panel is visible': 'Checks that the recent scored alerts panel is visible.',
    'Selenium Module heading is visible': 'Confirms that navigation reached the Selenium module.',
    'Scenario Catalog panel is visible': 'Checks that the module still lists the available automation scenarios.',
    'Generated Script Preview panel is visible': 'Confirms that the Selenium preview panel is visible.',
    'Scenario selector is present': 'Checks that the user can switch scenarios in the module UI.',
    'Browser prerequisites render': 'Confirms that the module still lists the setup needed to run the exported suite.',
    'Playwright Module heading is visible': 'Confirms that navigation reached the Playwright module.',
    'Generated Spec Preview panel is visible': 'Confirms that the Playwright preview panel is visible.',
    'Playwright prerequisites render': 'Confirms that the page still lists the setup needed to run the exported spec.',
    'Authentication succeeds with a disposable test user': 'Checks that the suite can establish an authenticated session before route checks begin.',
    'Research Workspace renders all module entry points': 'Checks that the workspace still exposes the expected module entry points.',
    'Security Module renders its main controls': 'Checks that the Security page still renders its primary controls.',
    'ML Module renders training and autonomy panels': 'Checks that the ML page still renders its training and autonomy panels.',
    'Selenium Module renders a script preview': 'Confirms that the Selenium export surface still shows a script preview.',
    'Playwright Module renders a spec preview': 'Confirms that the Playwright export surface still shows a spec preview.'
};

const TAG_DESCRIPTIONS = {
    smoke: 'Fast regression check for route and page-shell stability.',
    auth: 'Includes sign-in or other protected-route setup.',
    navigation: 'Focuses on reaching the right pages through stable paths.',
    security: 'Covers the Security module and related workspace surfaces.',
    workspace: 'Targets the cross-module research workflow.',
    browser: 'Uses browser-visible checks such as headings, panels, and controls.',
    ml: 'Targets the ML-assisted triage surfaces.',
    triage: 'Focuses on scoring, review, and autonomy-related UI.',
    selenium: 'Covers the Selenium export surface.',
    export: 'Focuses on generated automation artifacts.',
    playwright: 'Covers the Playwright export surface.',
    'full-suite': 'Covers the broadest path across multiple modules.',
    research: 'Anchored in the product\'s research workflow.'
};

function normalizeBaseUrl(baseUrl) {
    const normalized = typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim()
        : DEFAULT_BASE_URL;

    return normalized.replace(/\/+$/, '');
}

function describeRoutePath(routePath) {
    return ROUTE_DESCRIPTIONS[routePath] || DEFAULT_ROUTE_DESCRIPTION;
}

function describeAssertion(assertion) {
    return ASSERTION_DESCRIPTIONS[assertion] || DEFAULT_ASSERTION_DESCRIPTION;
}

function describeTag(tag) {
    return TAG_DESCRIPTIONS[tag] || 'Highlights the kind of browser check this scenario covers.';
}

function buildControlGuide() {
    return CONTROL_DEFINITIONS.map((control) => ({
        id: control.id,
        label: control.label,
        description: control.description,
        interaction: control.interaction
    }));
}

function buildScenarioFunctionDescription(scenario) {
    const routeLabel = scenario.routes.length === 1 ? 'route' : 'routes';
    return `${scenario.title} is a smoke path across ${scenario.routes.length} ${routeLabel} with stable, visible checks.`;
}

function getScenarioIds() {
    return SCENARIO_DEFINITIONS.map((scenario) => scenario.id);
}

function getScenarioDefinition(scenarioId = DEFAULT_SCENARIO_ID) {
    const normalizedId = typeof scenarioId === 'string' && scenarioId.trim()
        ? scenarioId.trim()
        : DEFAULT_SCENARIO_ID;

    return SCENARIO_DEFINITIONS.find((scenario) => scenario.id === normalizedId) || null;
}

function buildScenarioCatalog(baseUrl) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    return SCENARIO_DEFINITIONS.map((scenario) => ({
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
        routeTargets: scenario.routes.map((routePath) => ({
            path: routePath,
            url: `${normalizedBaseUrl}${routePath}`,
            description: describeRoutePath(routePath)
        })),
        functionDescription: buildScenarioFunctionDescription(scenario)
    }));
}

function buildPrerequisites(baseUrl) {
    return [
        {
            label: 'Authenticated test account',
            required: true,
            description: 'Required for scenarios that visit protected routes such as /research and the module pages.'
        },
        {
            label: 'Stable local app origin',
            required: true,
            description: `Exported specs default to ${normalizeBaseUrl(baseUrl)} and expect the app to stay reachable during the browser session.`
        },
        {
            label: '@playwright/test runtime',
            required: false,
            description: 'Needed only when you run the exported spec outside this module. Install @playwright/test and run npx playwright install in that project.'
        },
        {
            label: 'Optional realtime worker',
            required: false,
            description: 'Needed only if you extend the suite to validate live realtime behavior.'
        },
        {
            label: 'Optional trained ML model artifact',
            required: false,
            description: 'Optional for smoke coverage. The page and exported specs still work in heuristic mode.'
        }
    ];
}

function buildWorkflow() {
    return [
        {
            label: 'Authenticate',
            description: 'Sign in with a disposable test user before protected routes load.'
        },
        {
            label: 'Navigate',
            description: 'Move through the workspace with stable route targets instead of brittle click paths.'
        },
        {
            label: 'Assert',
            description: 'Check the headings, controls, and panels each page promises to expose.'
        },
        {
            label: 'Trace',
            description: 'Add screenshots, traces, or video when you need richer failure evidence.'
        },
        {
            label: 'Integrate',
            description: 'Use the generated spec as a starting point for local runs or CI.'
        }
    ];
}

function buildCoverageSummary(scenarios) {
    return {
        scenarioCount: scenarios.length,
        authenticatedScenarioCount: scenarios.filter((scenario) => scenario.requiresLogin).length,
        optionalDependencyCount: scenarios.reduce(
            (count, scenario) => count + scenario.optionalDependencies.length,
            0
        )
    };
}

function buildPlaywrightModuleOverview({ baseUrl } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarios = buildScenarioCatalog(normalizedBaseUrl);

    return {
        module: {
            name: 'Playwright Module',
            runtime: 'JavaScript + @playwright/test',
            targetBrowser: 'Chromium, Firefox, and WebKit',
            exportStyle: 'Generated starter spec',
            baseUrl: normalizedBaseUrl
        },
        coverage: buildCoverageSummary(scenarios),
        controls: buildControlGuide(),
        workflow: buildWorkflow(),
        prerequisites: buildPrerequisites(normalizedBaseUrl),
        scenarios,
        defaultScenarioId: DEFAULT_SCENARIO_ID,
        generatedAt: new Date().toISOString()
    };
}

const SCRIPT_STEP_MAP = {
    'workspace-navigation': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Security Module\');',
        'await expectBodyText(page, \'ML Module\');',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expectBodyText(page, \'Playwright Module\');'
    ].join('\n    '),
    'security-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Security Module\');',
        'await expectBodyText(page, \'Security Controls\');',
        'await expect(page.locator(\'#workspace-refresh-all\')).toBeVisible();',
        'await expectBodyText(page, \'Log Analysis\');',
        'await expectBodyText(page, \'Scan Importer\');'
    ].join('\n    '),
    'ml-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/ml/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'ML Module\');',
        'await expect(page.locator(\'#ml-train-hybrid-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Observed Autonomous Outcomes\');',
        'await expectBodyText(page, \'Learned Feature Influence\');',
        'await expectBodyText(page, \'Recent Scored Alerts\');'
    ].join('\n    '),
    'selenium-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/selenium/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expect(page.locator(\'#selenium-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Scenario Catalog\');',
        'await expectBodyText(page, \'Generated Script Preview\');',
        'await expectBodyText(page, \'Browser Prerequisites\');'
    ].join('\n    '),
    'playwright-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Playwright Module\');',
        'await expect(page.locator(\'#playwright-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Scenario Catalog\');',
        'await expectBodyText(page, \'Generated Spec Preview\');',
        'await expectBodyText(page, \'Playwright Prerequisites\');'
    ].join('\n    '),
    'research-full-suite': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expectBodyText(page, \'Playwright Module\');',
        '',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Security Module\');',
        'await expectBodyText(page, \'Security Controls\');',
        '',
        'await page.goto(`${baseUrl}/ml/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'ML Module\');',
        'await expectBodyText(page, \'Observed Autonomous Outcomes\');',
        '',
        'await page.goto(`${baseUrl}/selenium/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expectBodyText(page, \'Generated Script Preview\');',
        '',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Playwright Module\');',
        'await expectBodyText(page, \'Generated Spec Preview\');'
    ].join('\n    ')
};

function buildScriptSteps(scenarioId) {
    return SCRIPT_STEP_MAP[scenarioId] || SCRIPT_STEP_MAP[DEFAULT_SCENARIO_ID];
}

function buildScriptTemplate(baseUrl, scenario) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarioSteps = buildScriptSteps(scenario.id);

    return `const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || '${normalizedBaseUrl}';
const email = process.env.PLAYWRIGHT_TEST_EMAIL || 'test@example.com';
const password = process.env.PLAYWRIGHT_TEST_PASSWORD || 'password123';

async function expectBodyText(page, text) {
    await expect(page.locator('body')).toContainText(text);
}

async function signIn(page) {
    await page.goto(\`\${baseUrl}/auth/login\`, { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);

    await Promise.all([
        page.waitForURL((url) => !url.toString().includes('/auth/login'), { timeout: 15000 }),
        page.locator('form[action="/auth/login"] button[type="submit"]').click()
    ]);
}

test('${scenario.title}', async ({ page }) => {
    ${scenarioSteps}
});
`;
}

function buildScriptUsageNotes(fileName) {
    return [
        {
            label: 'Base URL override',
            description: 'Set PLAYWRIGHT_BASE_URL to target a different host.'
        },
        {
            label: 'Test credentials',
            description: 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD so the sign-in helper can reach protected routes.'
        },
        {
            label: 'Execution',
            description: `Place the exported file in a Playwright project and run npx playwright test ${fileName}.`
        }
    ];
}

function buildPlaywrightScript({ baseUrl, scenarioId = DEFAULT_SCENARIO_ID } = {}) {
    const scenario = getScenarioDefinition(scenarioId);

    if (!scenario) {
        throw new Error(`Unknown Playwright scenario: ${scenarioId}`);
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    return {
        scenarioId: scenario.id,
        title: scenario.title,
        purpose: scenario.purpose,
        fileName: `playwright-${scenario.id}.spec.js`,
        language: 'javascript',
        runtime: '@playwright/test',
        baseUrl: normalizedBaseUrl,
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
        usageNotes: buildScriptUsageNotes(`playwright-${scenario.id}.spec.js`),
        functionDescription: buildScenarioFunctionDescription(scenario),
        content: buildScriptTemplate(normalizedBaseUrl, scenario)
    };
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildPlaywrightModuleOverview,
    buildPlaywrightScript,
    getScenarioIds
};
