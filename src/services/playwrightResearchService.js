const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SCENARIO_ID = 'research-full-suite';

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

function normalizeBaseUrl(baseUrl) {
    const normalized = typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim()
        : DEFAULT_BASE_URL;

    return normalized.replace(/\/+$/, '');
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
        tags: [...scenario.tags],
        requiresLogin: scenario.requiresLogin,
        optionalDependencies: [...scenario.optionalDependencies]
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
        content: buildScriptTemplate(normalizedBaseUrl, scenario)
    };
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildPlaywrightModuleOverview,
    buildPlaywrightScript,
    getScenarioIds
};
