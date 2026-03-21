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
        purpose: 'Exercise the dedicated Security Module page and verify the core browser-visible controls that support log analysis, scans, correlations, and realtime status.',
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
        purpose: 'Verify that the Selenium Module itself renders scenario metadata and a generated script preview tailored to this application.',
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
        id: 'research-full-suite',
        title: 'Research Workspace Full Suite',
        purpose: 'Run one authenticated Selenium smoke script that moves through Research, Security, ML, Selenium, and Playwright module pages to validate the product-level research workflow end to end.',
        routes: ['/auth/login', '/research', '/security/module', '/ml/module', '/selenium/module', '/playwright/module'],
        assertions: [
            'Authentication succeeds with a disposable test user',
            'Research Workspace renders all module entry points',
            'Security Module renders its main controls',
            'ML Module renders training and autonomy panels',
            'Selenium Module renders a script preview',
            'Playwright Module renders a script preview'
        ],
        tags: ['full-suite', 'research', 'smoke'],
        requiresLogin: true,
        optionalDependencies: [
            'Redis-backed worker is optional unless you plan to extend the script to test realtime connect flow.',
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
            description: 'Selenium smoke scripts target protected routes such as /research, /security/module, /ml/module, /selenium/module, and /playwright/module.'
        },
        {
            label: 'Stable local app origin',
            required: true,
            description: `The generated scripts default to ${normalizeBaseUrl(baseUrl)} and expect the web app to stay reachable during the browser session.`
        },
        {
            label: 'Browser driver runtime',
            required: false,
            description: 'To execute the exported script outside this module, install selenium-webdriver and make ChromeDriver or EdgeDriver available on the machine that runs the suite.'
        },
        {
            label: 'Realtime worker',
            required: false,
            description: 'Only needed if you extend the browser smoke suite to validate live realtime connect-disconnect behavior.'
        },
        {
            label: 'Trained ML model artifact',
            required: false,
            description: 'Optional for smoke coverage. The module scripts still work if the app is operating in heuristic fallback mode.'
        }
    ];
}

function buildWorkflow() {
    return [
        {
            label: 'Authenticate',
            description: 'Open the login form, sign in with a disposable test user, and wait until the authenticated note or research routes become reachable.'
        },
        {
            label: 'Navigate',
            description: 'Move across the Research Workspace and module pages using stable route targets instead of brittle DOM-dependent multi-click flows.'
        },
        {
            label: 'Assert',
            description: 'Check for headings, buttons, and panels that reflect the product-level behavior each module promises to expose.'
        },
        {
            label: 'Export',
            description: 'Use the generated JavaScript template as a starting point for a real Selenium suite in an external automation project or CI job.'
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

function buildSeleniumModuleOverview({ baseUrl } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarios = buildScenarioCatalog(normalizedBaseUrl);

    return {
        module: {
            name: 'Selenium Module',
            runtime: 'JavaScript + selenium-webdriver',
            targetBrowser: 'Chrome or Edge',
            exportStyle: 'Generated smoke-suite template',
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
        'await signIn(driver);',
        'await driver.get(`${baseUrl}/research`);',
        'await expectBodyText(driver, \'Research Workspace\');',
        'await expectBodyText(driver, \'Security Module\');',
        'await expectBodyText(driver, \'ML Module\');',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await expectBodyText(driver, \'Playwright Module\');'
    ].join('\n    '),
    'security-module-smoke': [
        'await signIn(driver);',
        'await driver.get(`${baseUrl}/security/module`);',
        'await expectBodyText(driver, \'Security Module\');',
        'await expectBodyText(driver, \'Security Controls\');',
        'await driver.wait(until.elementLocated(By.id(\'workspace-refresh-all\')), 15000);',
        'await expectBodyText(driver, \'Log Analysis\');',
        'await expectBodyText(driver, \'Scan Importer\');'
    ].join('\n    '),
    'ml-module-smoke': [
        'await signIn(driver);',
        'await driver.get(`${baseUrl}/ml/module`);',
        'await expectBodyText(driver, \'ML Module\');',
        'await driver.wait(until.elementLocated(By.id(\'ml-train-hybrid-btn\')), 15000);',
        'await expectBodyText(driver, \'Observed Autonomous Outcomes\');',
        'await expectBodyText(driver, \'Learned Feature Influence\');',
        'await expectBodyText(driver, \'Recent Scored Alerts\');'
    ].join('\n    '),
    'selenium-module-smoke': [
        'await signIn(driver);',
        'await driver.get(`${baseUrl}/selenium/module`);',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await driver.wait(until.elementLocated(By.id(\'selenium-scenario-select\')), 15000);',
        'await expectBodyText(driver, \'Scenario Catalog\');',
        'await expectBodyText(driver, \'Generated Script Preview\');',
        'await expectBodyText(driver, \'Browser prerequisites\');'
    ].join('\n    '),
    'research-full-suite': [
        'await signIn(driver);',
        'await driver.get(`${baseUrl}/research`);',
        'await expectBodyText(driver, \'Research Workspace\');',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await expectBodyText(driver, \'Playwright Module\');',
        '',
        'await driver.get(`${baseUrl}/security/module`);',
        'await expectBodyText(driver, \'Security Module\');',
        'await expectBodyText(driver, \'Security Controls\');',
        '',
        'await driver.get(`${baseUrl}/ml/module`);',
        'await expectBodyText(driver, \'ML Module\');',
        'await expectBodyText(driver, \'Observed Autonomous Outcomes\');',
        '',
        'await driver.get(`${baseUrl}/selenium/module`);',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await expectBodyText(driver, \'Generated Script Preview\');',
        '',
        'await driver.get(`${baseUrl}/playwright/module`);',
        'await expectBodyText(driver, \'Playwright Module\');',
        'await expectBodyText(driver, \'Generated Spec Preview\');'
    ].join('\n    ')
};

function buildScriptSteps(scenarioId) {
    return SCRIPT_STEP_MAP[scenarioId] || SCRIPT_STEP_MAP[DEFAULT_SCENARIO_ID];
}

function buildScriptTemplate(baseUrl, scenario) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarioSteps = buildScriptSteps(scenario.id);

    return `const { Builder, By, until } = require('selenium-webdriver');
const assert = require('node:assert/strict');

const baseUrl = process.env.SELENIUM_BASE_URL || '${normalizedBaseUrl}';
const browserName = process.env.SELENIUM_BROWSER || 'chrome';
const email = process.env.SELENIUM_TEST_EMAIL || 'test@example.com';
const password = process.env.SELENIUM_TEST_PASSWORD || 'password123';

async function expectBodyText(driver, text) {
    await driver.wait(async () => {
        const body = await driver.findElement(By.css('body'));
        const content = await body.getText();
        return content.includes(text);
    }, 15000, \`Expected to find text: \${text}\`);
}

async function signIn(driver) {
    await driver.get(\`\${baseUrl}/auth/login\`);
    await driver.wait(until.elementLocated(By.id('email')), 15000);

    await driver.findElement(By.id('email')).clear();
    await driver.findElement(By.id('email')).sendKeys(email);
    await driver.findElement(By.id('password')).clear();
    await driver.findElement(By.id('password')).sendKeys(password);
    await driver.findElement(By.css('form[action="/auth/login"] button[type="submit"]')).click();

    await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return !currentUrl.includes('/auth/login');
    }, 15000, 'Login did not complete as expected.');
}

async function run() {
    const driver = await new Builder().forBrowser(browserName).build();

    try {
        ${scenarioSteps}
        console.log('Selenium smoke scenario completed: ${scenario.title}');
    } finally {
        await driver.quit();
    }
}

run().catch((error) => {
    console.error('Selenium scenario failed:', error);
    process.exitCode = 1;
});
`;
}

function buildSeleniumScript({ baseUrl, scenarioId = DEFAULT_SCENARIO_ID } = {}) {
    const scenario = getScenarioDefinition(scenarioId);

    if (!scenario) {
        throw new Error(`Unknown Selenium scenario: ${scenarioId}`);
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    return {
        scenarioId: scenario.id,
        title: scenario.title,
        purpose: scenario.purpose,
        fileName: `selenium-${scenario.id}.js`,
        language: 'javascript',
        runtime: 'selenium-webdriver',
        content: buildScriptTemplate(normalizedBaseUrl, scenario)
    };
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildSeleniumModuleOverview,
    buildSeleniumScript,
    getScenarioIds
};
