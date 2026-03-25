const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SCENARIO_ID = 'research-full-suite';
const DEFAULT_ROUTE_DESCRIPTION = 'Navigates directly to this stable route so the generated smoke suite can verify page-level behavior without depending on fragile click chains.';
const DEFAULT_ASSERTION_DESCRIPTION = 'Confirms that the page exposes the user-visible text or control expected by this scenario before deeper automation is added.';

const SCENARIO_DEFINITIONS = [
    {
        id: 'workspace-navigation',
        title: 'Research Workspace Navigation',
        purpose: 'Authenticate, open the Research Workspace, and verify that the Security, ML, Selenium, and Playwright entry points render for a signed-in user.',
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
        purpose: 'Exercise the dedicated Security Module page and verify the browser-visible controls that support log analysis, scans, correlations, and realtime status.',
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
        optionalDependencies: ['Redis-backed realtime is only needed if you want live stream checks beyond static UI presence.']
    },
    {
        id: 'ml-module-smoke',
        title: 'ML Module Smoke',
        purpose: 'Validate that the ML Module loads its browser controls and exposes the scoring, training, and autonomy panels expected by the research workflow.',
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
        optionalDependencies: ['A trained model artifact is optional; the page should still render in heuristic mode.']
    },
    {
        id: 'selenium-module-smoke',
        title: 'Selenium Module Smoke',
        purpose: 'Verify that the Selenium Module renders scenario metadata and a generated Selenium WebDriver script preview tailored to this application.',
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
        optionalDependencies: ['No local Selenium driver is required to inspect the generated scripts inside the app.']
    },
    {
        id: 'playwright-module-smoke',
        title: 'Playwright Module Smoke',
        purpose: 'Verify that the Playwright Module renders scenario metadata and a generated Playwright test preview tailored to this application.',
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
        optionalDependencies: ['No local Playwright browser install is required to inspect the generated scripts inside the app.']
    },
    {
        id: 'research-full-suite',
        title: 'Research Workspace Full Suite',
        purpose: 'Run one authenticated Playwright smoke suite that moves through Research, Security, ML, Selenium, and Playwright module pages to validate the product-level research workflow end to end.',
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
            'Redis-backed worker is optional unless you extend the suite to validate realtime connect flow.',
            'A seeded or disposable account is recommended for stable smoke-test expectations.'
        ]
    }
];

const CONTROL_DEFINITIONS = [
    {
        id: 'playwright-scenario-select',
        label: 'Scenario selector',
        description: 'Chooses which registered Playwright browser flow the page should describe and export. Changing the selection updates the scenario summary and the generated spec preview.',
        interaction: 'Select a scenario to switch the module from one smoke path to another, such as Research navigation, Security, ML, Selenium, Playwright, or the full cross-module suite.'
    },
    {
        id: 'playwright-refresh-btn',
        label: 'Refresh Module',
        description: 'Reloads the module metadata from the backend so the page re-renders the current scenario catalog, prerequisite notes, and default export details.',
        interaction: 'Use this after restarting the server or changing module definitions so the browser view matches the latest backend configuration.'
    },
    {
        id: 'playwright-load-script-btn',
        label: 'Load Spec',
        description: 'Fetches a generated Playwright spec template for the currently selected scenario and replaces the preview panel with that script.',
        interaction: 'Use this when you want to inspect one scenario in detail before copying it into a dedicated Playwright project or CI suite.'
    },
    {
        id: 'playwright-copy-script-btn',
        label: 'Copy Spec',
        description: 'Copies the currently loaded Playwright template to the clipboard so it can be pasted into a real browser-automation workspace.',
        interaction: 'This is the final export step after choosing a scenario and confirming that the generated preview matches the route flow you want to automate.'
    }
];

const ROUTE_DESCRIPTIONS = {
    '/auth/login': 'Starts the browser flow at the login form so the generated suite can establish an authenticated session before it attempts protected routes.',
    '/research': 'Opens the Research Workspace, which acts as the top-level hub that links out to the Security, ML, Selenium, and Playwright modules.',
    '/security/module': 'Loads the dedicated Security Module page so the spec can verify that log-analysis, scan-import, correlation, and realtime-status controls are still visible.',
    '/ml/module': 'Loads the ML Module so the generated suite can confirm that training, scoring, feature-influence, and autonomy-audit panels still render.',
    '/selenium/module': 'Loads the Selenium Module so the smoke suite can validate the browser-automation export surface that complements the Playwright module.',
    '/playwright/module': 'Loads the Playwright Module itself so the browser suite can confirm that scenario metadata and generated spec preview features remain available.'
};

const ASSERTION_DESCRIPTIONS = {
    'Login form is reachable': 'Proves the auth entry point loads and that the suite can begin from a known state instead of failing before protected navigation starts.',
    'Research Workspace heading is visible': 'Confirms that the top-level workspace rendered successfully after authentication.',
    'Security Module card is present': 'Verifies that the Research page still exposes the Security module entry point users rely on.',
    'ML Module card is present': 'Verifies that the Research page still exposes the ML module entry point.',
    'Selenium Module card is present': 'Verifies that the Research page still exposes the Selenium module entry point.',
    'Playwright Module card is present': 'Verifies that the Research page still exposes the Playwright module entry point.',
    'Security Module heading is visible': 'Confirms that navigation reached the dedicated Security module instead of a redirect, error page, or stale route.',
    'Refresh Module button is present': 'Checks that the main page control for reloading Security-module data is still rendered.',
    'Realtime server badge is visible': 'Confirms that the page still surfaces server-visible realtime capability status to the browser.',
    'Log Analysis section is visible': 'Checks that the page still renders the browser-facing controls for manual log analysis.',
    'Scan Importer section is visible': 'Checks that the page still renders the browser-facing scan import tools.',
    'ML Module heading is visible': 'Confirms that navigation reached the ML module and that its page shell still renders.',
    'Train Hybrid Model button is present': 'Checks that the main browser action for training the hybrid ML model is still exposed.',
    'Observed Autonomous Outcomes panel is visible': 'Confirms that the ML page still surfaces stored autonomous-response audit results.',
    'Learned Feature Influence panel is visible': 'Checks that the explainability panel for learned weights still renders.',
    'Recent Scored Alerts panel is visible': 'Verifies that the recent-alert scoring table still appears in the ML module.',
    'Selenium Module heading is visible': 'Confirms that navigation reached the Selenium export surface.',
    'Scenario Catalog panel is visible': 'Checks that the module still renders a browsable list of supported automation scenarios.',
    'Generated Script Preview panel is visible': 'Confirms that the Selenium export preview is still rendered for browser inspection.',
    'Scenario selector is present': 'Checks that the user can switch between exported automation scenarios from within the module UI.',
    'Browser prerequisites render': 'Verifies that the module still documents the environment expectations required to execute generated browser suites.',
    'Playwright Module heading is visible': 'Confirms that navigation reached the Playwright export surface.',
    'Generated Spec Preview panel is visible': 'Confirms that the page still renders the Playwright template preview that users export into real suites.',
    'Playwright prerequisites render': 'Verifies that the page still explains what must exist before the generated Playwright template will run reliably.',
    'Authentication succeeds with a disposable test user': 'Confirms that the generated suite can establish a known authenticated state instead of assuming one.',
    'Research Workspace renders all module entry points': 'Checks that the app-level navigation hub still exposes the expected research modules.',
    'Security Module renders its main controls': 'Checks that the Security page still renders the primary user-visible controls expected by smoke coverage.',
    'ML Module renders training and autonomy panels': 'Checks that the ML page still renders the user-visible panels that represent the training and autonomy workflow.',
    'Selenium Module renders a script preview': 'Confirms that the Selenium export surface still produces a previewable template.',
    'Playwright Module renders a spec preview': 'Confirms that the Playwright export surface still produces a previewable template.'
};

const TAG_DESCRIPTIONS = {
    smoke: 'A fast confidence check meant to catch route-level or UI-shell regressions before deeper automation is added.',
    auth: 'Touches authentication setup or protected-route behavior before browser assertions continue.',
    navigation: 'Focuses on moving through the product safely and proving the expected pages can still be reached.',
    security: 'Covers the Security module and related research surfaces.',
    workspace: 'Targets the cross-module workspace experience rather than one isolated backend endpoint.',
    browser: 'Designed for browser-visible assertions such as headings, panels, and controls.',
    ml: 'Targets the ML-assisted triage and model-operations surfaces.',
    triage: 'Focuses on alert scoring, review, and autonomy-related UI concepts.',
    selenium: 'Covers the Selenium export surface for browser automation.',
    export: 'Emphasizes generated automation artifacts that are meant to be copied into a real test project.',
    playwright: 'Covers the Playwright export surface itself.',
    'full-suite': 'Represents the broadest smoke path that crosses multiple modules in one authenticated run.',
    research: 'Anchored in the product’s research workflow and navigation model.'
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
    return TAG_DESCRIPTIONS[tag] || 'Highlights the type of browser-automation concern this scenario is intended to cover.';
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
    return `${scenario.title} functions as a focused smoke layer for ${scenario.routes.length} route target(s), emphasizing stable browser-visible evidence instead of deep behavioral scripting.`;
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
            description: 'Playwright smoke suites target protected routes such as /research, /security/module, /ml/module, /selenium/module, and /playwright/module.'
        },
        {
            label: 'Stable local app origin',
            required: true,
            description: `The generated specs default to ${normalizeBaseUrl(baseUrl)} and expect the web app to stay reachable during the browser session.`
        },
        {
            label: '@playwright/test runtime',
            required: false,
            description: 'To execute the exported spec outside this module, install @playwright/test and run npx playwright install on the machine that owns the browser suite.'
        },
        {
            label: 'Optional realtime worker',
            required: false,
            description: 'Only needed if you extend the browser smoke suite to validate live realtime connect-disconnect behavior.'
        },
        {
            label: 'Optional trained ML model artifact',
            required: false,
            description: 'The page and generated specs still work if the app is operating in heuristic fallback mode.'
        }
    ];
}

function buildWorkflow() {
    return [
        {
            label: 'Authenticate',
            description: 'Open the login form, sign in with a disposable test user, and wait until protected routes become reachable.'
        },
        {
            label: 'Navigate',
            description: 'Move across the Research Workspace and module pages with stable route targets instead of fragile click chains.'
        },
        {
            label: 'Assert',
            description: 'Use Playwright text and locator assertions to confirm the headings, controls, and panels that each module promises to expose.'
        },
        {
            label: 'Trace',
            description: 'Extend the generated spec with screenshots, traces, or video capture when you want richer browser evidence for failures.'
        },
        {
            label: 'Integrate',
            description: 'Use the generated spec as a starting point for a real Playwright suite in CI or in a separate browser-automation project.'
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
            exportStyle: 'Generated Playwright spec template',
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
            description: 'Set PLAYWRIGHT_BASE_URL if the exported spec should point at a different host than the module default.'
        },
        {
            label: 'Test credentials',
            description: 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD so the generated sign-in helper can authenticate before protected routes are visited.'
        },
        {
            label: 'Execution',
            description: `Place the exported file into a Playwright project and run it with a command such as npx playwright test ${fileName}.`
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
