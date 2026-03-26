const fs = require('fs');
const path = require('path');
const {
    DEFAULT_SELENIUM_SCENARIO_ID,
    getSeleniumScenario,
    listSeleniumScenarios
} = require('../lib/seleniumScenarioRegistry');
const {
    COMMON_ASSERTION_DESCRIPTIONS,
    COMMON_ROUTE_DESCRIPTIONS,
    COMMON_TAG_DESCRIPTIONS,
    buildControlGuide,
    buildCoverageSummary,
    buildScenarioCatalog,
    buildScriptMetadata,
    collectSuiteFiles,
    normalizeBaseUrl
} = require('./browserResearchModuleShared');

const DEFAULT_SCENARIO_ID = DEFAULT_SELENIUM_SCENARIO_ID;
const SELENIUM_RESULTS_PATH = path.join(process.cwd(), 'artifacts', 'selenium-results.json');
const DEFAULT_ROUTE_DESCRIPTION = 'Visits this route directly so the Selenium suite can verify the page without relying on brittle click paths.';
const DEFAULT_ASSERTION_DESCRIPTION = 'Checks for stable UI text or controls before deeper browser automation is added.';

const CONTROL_DEFINITIONS = [
    {
        id: 'selenium-scenario-select',
        label: 'Scenario selector',
        description: 'Chooses the Selenium flow shown in the summary and generated script preview.',
        interaction: 'Use it to switch between auth checks, notes flows, module interactions, and the full workspace suite.'
    },
    {
        id: 'selenium-refresh-btn',
        label: 'Refresh Module',
        description: 'Reloads the module overview and the latest Selenium run summary from the server.',
        interaction: 'Use it after rerunning the Selenium suite or changing the registered Selenium scenarios.'
    },
    {
        id: 'selenium-load-script-btn',
        label: 'Load Script',
        description: 'Loads the starter WebDriver script for the currently selected scenario.',
        interaction: 'Use it when you want to inspect one scenario in detail before exporting it.'
    },
    {
        id: 'selenium-copy-script-btn',
        label: 'Copy Script',
        description: 'Copies the current Selenium script preview to the clipboard.',
        interaction: 'Use it after the preview matches the browser path you want to automate outside this app.'
    }
];

const ROUTE_DESCRIPTIONS = {
    ...COMMON_ROUTE_DESCRIPTIONS,
    '/security/module': 'Opens the Security Module so the suite can verify log analysis, scan import, and correlation controls.',
    '/ml/module': 'Opens the ML Module so the suite can verify training, autonomy, and recent scored-alert panels.',
    '/selenium/module': 'Opens the Selenium Module so the suite can verify exported WebDriver coverage and latest-run metadata.',
    '/playwright/module': 'Opens the Playwright Module so cross-module Selenium navigation can confirm the broader browser-testing workflow.'
};

const ASSERTION_DESCRIPTIONS = {
    ...COMMON_ASSERTION_DESCRIPTIONS,
    'Workspace navigation buttons open each module': 'Checks that the Research Workspace buttons still reach the expected module pages.',
    'Refresh Module button reloads the ML overview': 'Checks that the ML refresh control updates the module overview in place.',
    'Autonomy demo injects recent scored alerts': 'Checks that the autonomy demo creates browser-visible scored alerts.',
    'Selenium Module heading is visible': 'Confirms that navigation reached the Selenium Module.',
    'Latest suite run panel is visible': 'Checks that the module exposes the latest Selenium run summary, even when no results file exists yet.',
    'Scenario count is visible': 'Checks that the Selenium Module surfaces how many registered scenarios it knows about.',
    'Generated Script Preview panel is visible': 'Confirms that the Selenium script preview surface is visible.',
    'Scenario selector is present': 'Checks that the user can switch Selenium scenarios inside the module.',
    'Scenario selector updates the generated script': 'Checks that changing the selected Selenium scenario updates the generated preview.',
    'Load Script button refreshes the preview': 'Checks that the explicit Load Script control reloads the selected Selenium template.',
    'Security Module script preview references the security route': 'Checks that the Security workflow template still points at the Security Module path.',
    'Research full suite preview references cross-module routes': 'Checks that the full-suite template still covers the Security, ML, Selenium, and Playwright pages.',
    'Refresh Module button reloads the overview': 'Checks that the Selenium module refresh action reloads the latest overview data.',
    'Playwright Module navigation button remains available': 'Checks that the module still links back into the broader Research browser-testing workflow.',
    'Playwright Module heading loads from Selenium navigation': 'Checks that Selenium-to-Playwright navigation still lands on the expected destination.',
    'Security Module renders its workflow controls': 'Checks that the Security Module still renders the controls used by the Selenium workflow.',
    'ML Module renders its autonomy controls': 'Checks that the ML Module still renders its training and autonomy surfaces.',
    'Selenium Module renders latest suite metadata': 'Checks that the Selenium Module still renders latest-run and export metadata.',
    'Playwright Module renders its starter spec preview': 'Checks that the Playwright Module still renders its generated starter spec preview.'
};

const TAG_DESCRIPTIONS = {
    ...COMMON_TAG_DESCRIPTIONS,
    selenium: 'Covers the Selenium export surface or Selenium-driven browser flow.',
    playwright: 'Covers the Playwright export surface.'
};

function describeRoutePath(routePath) {
    return ROUTE_DESCRIPTIONS[routePath] || DEFAULT_ROUTE_DESCRIPTION;
}

function describeAssertion(assertion) {
    return ASSERTION_DESCRIPTIONS[assertion] || DEFAULT_ASSERTION_DESCRIPTION;
}

function describeTag(tag) {
    return TAG_DESCRIPTIONS[tag] || 'Highlights the kind of Selenium browser check this scenario covers.';
}

function buildScenarioFunctionDescription(scenario) {
    const routeLabel = scenario.routes.length === 1 ? 'route' : 'routes';
    return `${scenario.title} is a Selenium smoke path across ${scenario.routes.length} ${routeLabel} with stable, browser-visible checks.`;
}

function getScenarioIds() {
    return listSeleniumScenarios().map((scenario) => scenario.id);
}

function getScenarioDefinition(scenarioId = DEFAULT_SCENARIO_ID) {
    const normalizedId = typeof scenarioId === 'string' && scenarioId.trim()
        ? scenarioId.trim()
        : DEFAULT_SCENARIO_ID;

    return getSeleniumScenario(normalizedId);
}

function buildPrerequisites(baseUrl) {
    return [
        {
            label: 'Stable local app origin',
            required: true,
            description: `The Selenium suite targets ${normalizeBaseUrl(baseUrl)} and expects the app to stay reachable for the full browser session.`
        },
        {
            label: 'Browser driver runtime',
            required: true,
            description: 'A Chrome or Edge WebDriver runtime is required to execute the Selenium suite or the exported script outside this module.'
        },
        {
            label: 'Disposable or reusable test account',
            required: false,
            description: 'The generated scripts can create disposable accounts automatically, but you can also set SELENIUM_TEST_EMAIL and SELENIUM_TEST_PASSWORD to reuse an existing account.'
        },
        {
            label: 'Realtime worker',
            required: false,
            description: 'Only needed if you extend the Selenium suite to validate live realtime connect-disconnect behavior.'
        },
        {
            label: 'Trained ML model artifact',
            required: false,
            description: 'Optional for smoke coverage. The ML page still renders in heuristic mode when no trained model artifact is loaded.'
        }
    ];
}

function buildWorkflow() {
    return [
        {
            label: 'Authenticate',
            description: 'Open the auth screens, create or reuse credentials, and establish a browser session before protected routes are visited.'
        },
        {
            label: 'Navigate',
            description: 'Move through Notes, Research, and the dedicated module pages with stable route targets and visible navigation buttons.'
        },
        {
            label: 'Assert',
            description: 'Check for headings, counters, buttons, panels, and persisted data that reflect product-level behavior.'
        },
        {
            label: 'Report',
            description: 'Write the latest Selenium run to artifacts/selenium-results.json so the module page can reflect the last completed suite.'
        },
        {
            label: 'Export',
            description: 'Use the generated WebDriver template as a starting point for a standalone Selenium project or CI smoke job.'
        }
    ];
}

function normalizeRunStatus(status) {
    switch (status) {
        case 'passed':
            return 'passed';
        case 'failed':
            return 'failed';
        case 'skipped':
        case 'pending':
            return 'skipped';
        default:
            return 'unknown';
    }
}

function summarizeAggregateStatus(currentStatus, nextStatus) {
    const severity = {
        failed: 3,
        passed: 2,
        skipped: 1,
        unknown: 0
    };

    return severity[nextStatus] > severity[currentStatus] ? nextStatus : currentStatus;
}

function buildLatestRunSummary(reportPath = SELENIUM_RESULTS_PATH) {
    if (!fs.existsSync(reportPath)) {
        return {
            available: false,
            status: 'unavailable',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0,
            generatedAt: '',
            sourcePath: 'artifacts/selenium-results.json',
            browserName: 'unknown',
            headless: true,
            baseUrl: normalizeBaseUrl(),
            files: [],
            scenarioResults: []
        };
    }

    try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const stats = report && report.stats ? report.stats : {};
        const fileStats = fs.statSync(reportPath);
        const tests = Array.isArray(report.tests) ? report.tests : [];
        const scenarioTitleIndex = new Map(
            listSeleniumScenarios().map((scenario) => [scenario.title, scenario.id])
        );
        const files = new Map();
        const summary = {
            available: true,
            status: 'unknown',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationMs: typeof stats.durationMs === 'number' ? stats.durationMs : 0,
            generatedAt: report.generatedAt || stats.endTime || fileStats.mtime.toISOString(),
            sourcePath: 'artifacts/selenium-results.json',
            browserName: report.runtime && report.runtime.browserName ? report.runtime.browserName : 'unknown',
            headless: report.runtime ? Boolean(report.runtime.headless) : true,
            baseUrl: report.runtime && report.runtime.baseUrl ? report.runtime.baseUrl : normalizeBaseUrl()
        };
        const scenarioResults = [];

        tests.forEach((testEntry) => {
            const normalizedStatus = normalizeRunStatus(testEntry && testEntry.status);
            const file = testEntry && typeof testEntry.file === 'string' ? testEntry.file : 'unknown';
            const scenarioId = testEntry && typeof testEntry.scenarioId === 'string' && testEntry.scenarioId
                ? testEntry.scenarioId
                : scenarioTitleIndex.get(testEntry && testEntry.title ? testEntry.title : '') || '';

            summary.total += 1;
            summary.status = summarizeAggregateStatus(summary.status, normalizedStatus);

            if (normalizedStatus === 'passed') {
                summary.passed += 1;
            } else if (normalizedStatus === 'failed') {
                summary.failed += 1;
            } else if (normalizedStatus === 'skipped') {
                summary.skipped += 1;
            }

            const fileSummary = files.get(file) || {
                file,
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                status: 'unknown'
            };

            fileSummary.total += 1;
            fileSummary.status = summarizeAggregateStatus(fileSummary.status, normalizedStatus);

            if (normalizedStatus === 'passed') {
                fileSummary.passed += 1;
            } else if (normalizedStatus === 'failed') {
                fileSummary.failed += 1;
            } else if (normalizedStatus === 'skipped') {
                fileSummary.skipped += 1;
            }

            files.set(file, fileSummary);

            scenarioResults.push({
                scenarioId,
                title: testEntry && testEntry.title ? testEntry.title : '',
                file,
                status: normalizedStatus,
                durationMs: testEntry && typeof testEntry.durationMs === 'number' ? testEntry.durationMs : 0
            });
        });

        return {
            ...summary,
            files: Array.from(files.values()),
            scenarioResults
        };
    } catch (error) {
        return {
            available: false,
            status: 'unavailable',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0,
            generatedAt: '',
            sourcePath: 'artifacts/selenium-results.json',
            browserName: 'unknown',
            headless: true,
            baseUrl: normalizeBaseUrl(),
            error: error.message,
            files: [],
            scenarioResults: []
        };
    }
}

function buildScenarioRunIndex(latestRun) {
    const index = new Map();

    if (!latestRun || !latestRun.available || !Array.isArray(latestRun.scenarioResults)) {
        return index;
    }

    latestRun.scenarioResults.forEach((result) => {
        if (!result.scenarioId) {
            return;
        }

        const current = index.get(result.scenarioId) || {
            status: 'unknown',
            durationMs: 0,
            file: '',
            browserName: latestRun.browserName || 'unknown',
            headless: Boolean(latestRun.headless),
            generatedAt: latestRun.generatedAt || ''
        };

        current.status = summarizeAggregateStatus(current.status, result.status || 'unknown');
        current.durationMs = result.durationMs || current.durationMs;
        current.file = result.file || current.file;

        index.set(result.scenarioId, current);
    });

    return index;
}

function buildSeleniumModuleOverview({ baseUrl } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const latestRun = buildLatestRunSummary();
    const scenarioRunIndex = buildScenarioRunIndex(latestRun);
    const scenarios = buildScenarioCatalog({
        baseUrl: normalizedBaseUrl,
        listScenarios: listSeleniumScenarios,
        describeRoutePath,
        describeAssertion,
        describeTag,
        buildScenarioFunctionDescription
    }).map((scenario) => {
        const latestScenarioRun = scenarioRunIndex.get(scenario.id);

        return {
            ...scenario,
            latestRunStatus: latestScenarioRun ? latestScenarioRun.status : 'unknown',
            latestRunDurationMs: latestScenarioRun ? latestScenarioRun.durationMs : 0,
            latestRunFile: latestScenarioRun ? latestScenarioRun.file : '',
            latestRunBrowserName: latestScenarioRun ? latestScenarioRun.browserName : '',
            latestRunHeadless: latestScenarioRun ? latestScenarioRun.headless : false
        };
    });
    const suiteFiles = collectSuiteFiles(listSeleniumScenarios);

    return {
        module: {
            name: 'Selenium Module',
            runtime: 'JavaScript + selenium-webdriver',
            targetBrowser: 'Chrome or Edge',
            exportStyle: 'Generated starter WebDriver suite',
            baseUrl: normalizedBaseUrl
        },
        coverage: buildCoverageSummary(scenarios),
        suite: {
            implementedScenarioCount: scenarios.filter((scenario) => scenario.implementedInSuite).length,
            suiteFiles,
            latestRun
        },
        controls: buildControlGuide(CONTROL_DEFINITIONS),
        workflow: buildWorkflow(),
        prerequisites: buildPrerequisites(normalizedBaseUrl),
        scenarios,
        defaultScenarioId: DEFAULT_SCENARIO_ID,
        generatedAt: new Date().toISOString()
    };
}

const SCRIPT_STEP_MAP = {
    'auth-login-form': [
        'await driver.get(`${baseUrl}/auth/login`);',
        'await driver.wait(until.elementLocated(By.css(\'form[action="/auth/login"]\')), 15000);',
        'await expectBodyText(driver, \'Login\');',
        'await driver.findElement(By.id(\'email\'));',
        'await driver.findElement(By.id(\'password\'));'
    ].join('\n        '),
    'auth-signup-form': [
        'await driver.get(`${baseUrl}/auth/signup`);',
        'await driver.wait(until.elementLocated(By.css(\'form[action="/auth/signup"]\')), 15000);',
        'await expectBodyText(driver, \'Sign Up\');',
        'await expectBodyText(driver, \'Password requirements:\');',
        'await driver.findElement(By.id(\'password\'));'
    ].join('\n        '),
    'research-selenium-entry-flow': [
        'const credentials = await createAuthenticatedSession(driver);',
        'await expectBodyText(driver, `Welcome, ${credentials.email}`);',
        'await clickElement(driver, By.linkText(\'Research\'));',
        'await waitForLocationContains(driver, \'/research\');',
        'await expectBodyText(driver, \'Research Workspace\');'
    ].join('\n        '),
    'notes-crud-workflow': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/notes/new`);',
        'await driver.wait(until.elementLocated(By.css(\'form[action="/notes"]\')), 15000);',
        'await driver.findElement(By.id(\'title\')).sendKeys(\'Selenium CRUD note\');',
        'await driver.findElement(By.id(\'content\')).sendKeys(\'Created through the exported Selenium Notes workflow.\');',
        'await clickElement(driver, By.css(\'form[action="/notes"] button[type="submit"]\'));',
        'await waitForLocationContains(driver, \'/notes\');',
        'await expectBodyText(driver, \'Selenium CRUD note\');'
    ].join('\n        '),
    'workspace-navigation': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/research`);',
        'await expectBodyText(driver, \'Research Workspace\');',
        'await expectBodyText(driver, \'Security Module\');',
        'await expectBodyText(driver, \'ML Module\');',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await expectBodyText(driver, \'Playwright Module\');',
        'await expectBodyText(driver, \'Self-Healing Module\');'
    ].join('\n        '),
    'security-module-workflow': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/security/module`);',
        'await expectBodyText(driver, \'Security Module\');',
        'await clickElement(driver, By.id(\'workspace-load-sample-log\'));',
        'await waitForElementValue(driver, By.id(\'workspace-log-text\'), (value) => value.includes(\'POST /auth/login 401\'));',
        'await clickElement(driver, By.css(\'#workspace-log-form button[type="submit"]\'));',
        'await waitForBodyText(driver, /alert\\(s\\) created/);',
        'await clickElement(driver, By.id(\'workspace-load-sample-scan\'));',
        'await waitForElementValue(driver, By.id(\'workspace-scan-text\'), (value) => value.includes(\'Nikto v2.1.6\'));',
        'await clickElement(driver, By.css(\'#workspace-scan-form button[type="submit"]\'));',
        'await waitForBodyText(driver, /Scan imported with/);',
        'await clickElement(driver, By.id(\'workspace-inject-correlation-demo\'));',
        'await waitForBodyText(driver, /Injected \\d+ demo scans and \\d+ demo alerts/);'
    ].join('\n        '),
    'ml-module-workflow': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/ml/module`);',
        'await expectBodyText(driver, \'ML Module\');',
        'await clickElement(driver, By.id(\'ml-refresh-btn\'));',
        'await waitForBodyText(driver, \'ML module refreshed.\');',
        'await clickElement(driver, By.id(\'ml-autonomy-demo-btn\'));',
        'await waitForBodyText(driver, /Injected \\d+ autonomy demo alert\\(s\\) in dry-run mode\\./);'
    ].join('\n        '),
    'selenium-module-overview': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/selenium/module`);',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await driver.findElement(By.id(\'selenium-suite-implemented-count\'));',
        'await driver.findElement(By.id(\'selenium-scenario-count\'));',
        'await driver.findElement(By.id(\'selenium-script-code\'));'
    ].join('\n        '),
    'selenium-script-preview-updates': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/selenium/module`);',
        'await clickElement(driver, By.css(\'#selenium-scenario-select option[value="security-module-workflow"]\'));',
        'await waitForElementText(driver, By.id(\'selenium-script-file-badge\'), (text) => text.includes(\'security-module-workflow\'));',
        'await clickElement(driver, By.css(\'#selenium-scenario-select option[value="research-full-suite"]\'));',
        'await clickElement(driver, By.id(\'selenium-load-script-btn\'));',
        'await waitForBodyText(driver, \'Loaded the selected Selenium script template.\');'
    ].join('\n        '),
    'selenium-module-navigation': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/selenium/module`);',
        'await clickElement(driver, By.id(\'selenium-refresh-btn\'));',
        'await waitForBodyText(driver, \'Selenium module refreshed.\');',
        'await clickElement(driver, By.css(\'a[href="/playwright/module"]\'));',
        'await waitForLocationContains(driver, \'/playwright/module\');',
        'await expectBodyText(driver, \'Playwright Module\');'
    ].join('\n        '),
    'research-full-suite': [
        'await createAuthenticatedSession(driver);',
        'await driver.get(`${baseUrl}/research`);',
        'await expectBodyText(driver, \'Research Workspace\');',
        'await expectBodyText(driver, \'Selenium Module\');',
        'await expectBodyText(driver, \'Self-Healing Module\');',
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
        'await expectBodyText(driver, \'Latest Suite Run\');',
        '',
        'await driver.get(`${baseUrl}/playwright/module`);',
        'await expectBodyText(driver, \'Playwright Module\');',
        'await expectBodyText(driver, \'Generated Spec Preview\');',
        '',
        'await driver.get(`${baseUrl}/self-healing/module`);',
        'await expectBodyText(driver, \'Self-Healing Module\');',
        'await expectBodyText(driver, \'Repair Candidates\');'
    ].join('\n        ')
};

function buildScriptSteps(scenarioId) {
    return SCRIPT_STEP_MAP[scenarioId] || SCRIPT_STEP_MAP[DEFAULT_SCENARIO_ID];
}

function buildScriptUsageNotes(fileName) {
    return [
        {
            label: 'Base URL override',
            description: 'Set SELENIUM_BASE_URL to target a different host.'
        },
        {
            label: 'Browser selection',
            description: 'Set SELENIUM_BROWSER to edge or chrome, and set SELENIUM_HEADLESS=0 if you want a visible browser session.'
        },
        {
            label: 'Test credentials',
            description: 'Set SELENIUM_TEST_EMAIL and SELENIUM_TEST_PASSWORD to reuse an existing account. If you omit SELENIUM_TEST_EMAIL, the script will create a disposable account automatically.'
        },
        {
            label: 'Execution',
            description: `Save the exported file and run node ${fileName} in a project with selenium-webdriver installed.`
        }
    ];
}

function buildScriptTemplate(baseUrl, scenario) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarioSteps = buildScriptSteps(scenario.id);

    return `const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');

const baseUrl = process.env.SELENIUM_BASE_URL || '${normalizedBaseUrl}';
const browserName = String(process.env.SELENIUM_BROWSER || 'edge').trim().toLowerCase();
const headless = process.env.SELENIUM_HEADLESS !== '0';
const providedEmail = process.env.SELENIUM_TEST_EMAIL || '';
const providedPassword = process.env.SELENIUM_TEST_PASSWORD || 'Password123';

function buildCredentials() {
    if (providedEmail) {
        return {
            email: providedEmail,
            password: providedPassword
        };
    }

    const runId = \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
    return {
        email: \`selenium-\${runId}@example.com\`,
        password: providedPassword
    };
}

async function waitForBodyText(driver, textOrPattern, timeoutMs = 15000) {
    await driver.wait(async () => {
        const bodyText = await driver.findElement(By.css('body')).getText();

        if (textOrPattern instanceof RegExp) {
            return textOrPattern.test(bodyText);
        }

        return bodyText.includes(String(textOrPattern));
    }, timeoutMs, \`Expected page body to include \${textOrPattern}\`);
}

async function expectBodyText(driver, textOrPattern, timeoutMs = 15000) {
    await waitForBodyText(driver, textOrPattern, timeoutMs);
}

async function waitForElementText(driver, locator, predicate, timeoutMs = 15000) {
    await driver.wait(async () => {
        const text = await driver.findElement(locator).getText();
        return predicate(text);
    }, timeoutMs, 'Expected element text to reach the desired state.');
}

async function waitForElementValue(driver, locator, predicate, timeoutMs = 15000) {
    await driver.wait(async () => {
        const value = await driver.findElement(locator).getAttribute('value');
        return predicate(value);
    }, timeoutMs, 'Expected element value to reach the desired state.');
}

async function waitForLocationContains(driver, value, timeoutMs = 15000) {
    await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl.includes(value);
    }, timeoutMs, \`Expected URL to include \${value}\`);
}

async function clickElement(driver, locator, timeoutMs = 15000) {
    const element = await driver.wait(until.elementLocated(locator), timeoutMs);

    await driver.executeScript(
        'arguments[0].scrollIntoView({ block: "center", inline: "center" });',
        element
    );

    try {
        await element.click();
    } catch (_error) {
        await driver.executeScript('arguments[0].click();', element);
    }
}

async function signUp(driver, credentials) {
    await driver.get(\`\${baseUrl}/auth/signup\`);
    await driver.wait(until.elementLocated(By.id('email')), 15000);

    await driver.findElement(By.id('email')).sendKeys(credentials.email);
    await driver.findElement(By.id('password')).sendKeys(credentials.password);
    await clickElement(driver, By.css('form[action="/auth/signup"] button[type="submit"]'));
    await waitForLocationContains(driver, '/auth/login');
}

async function signIn(driver, credentials) {
    await driver.get(\`\${baseUrl}/auth/login\`);
    await driver.wait(until.elementLocated(By.id('email')), 15000);

    await driver.findElement(By.id('email')).sendKeys(credentials.email);
    await driver.findElement(By.id('password')).sendKeys(credentials.password);
    await clickElement(driver, By.css('form[action="/auth/login"] button[type="submit"]'));
    await waitForLocationContains(driver, '/notes');
}

async function createAuthenticatedSession(driver) {
    const credentials = buildCredentials();

    if (!providedEmail) {
        await signUp(driver, credentials);
    }

    await signIn(driver, credentials);
    return credentials;
}

function createChromeDriver() {
    const options = new chrome.Options();
    options.addArguments('--window-size=1440,1200');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');

    if (headless) {
        options.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
}

function createEdgeDriver() {
    const options = new edge.Options();
    options.addArguments('--window-size=1440,1200');
    options.addArguments('--disable-gpu');

    if (headless) {
        options.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('MicrosoftEdge')
        .setEdgeOptions(options)
        .build();
}

function createDriver() {
    return browserName === 'chrome'
        ? createChromeDriver()
        : createEdgeDriver();
}

async function run() {
    const driver = await createDriver();

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
    const latestRun = buildLatestRunSummary();
    const scenarioRunIndex = buildScenarioRunIndex(latestRun);
    const latestScenarioRun = scenarioRunIndex.get(scenario.id);

    return buildScriptMetadata({
        baseUrl: normalizedBaseUrl,
        scenario,
        describeRoutePath,
        describeAssertion,
        describeTag,
        buildScenarioFunctionDescription,
        usageNotes: buildScriptUsageNotes(`selenium-${scenario.id}.js`),
        content: buildScriptTemplate(normalizedBaseUrl, scenario),
        extra: {
            fileName: `selenium-${scenario.id}.js`,
            language: 'javascript',
            runtime: 'selenium-webdriver',
            baseUrl: normalizedBaseUrl,
            latestRunStatus: latestScenarioRun ? latestScenarioRun.status : 'unknown',
            latestRunDurationMs: latestScenarioRun ? latestScenarioRun.durationMs : 0,
            latestRunFile: latestScenarioRun ? latestScenarioRun.file : '',
            latestRunBrowserName: latestScenarioRun ? latestScenarioRun.browserName : '',
            latestRunHeadless: latestScenarioRun ? latestScenarioRun.headless : false
        }
    });
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildLatestRunSummary,
    buildSeleniumModuleOverview,
    buildSeleniumScript,
    getScenarioIds
};
