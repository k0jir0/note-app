const path = require('path');
const {
    DEFAULT_PLAYWRIGHT_SCENARIO_ID,
    getPlaywrightScenario,
    listPlaywrightScenarios
} = require('../lib/playwrightScenarioRegistry');
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
const { readCachedJsonArtifact } = require('./browserArtifactCache');

const DEFAULT_SCENARIO_ID = DEFAULT_PLAYWRIGHT_SCENARIO_ID;
const PLAYWRIGHT_RESULTS_PATH = path.join(process.cwd(), 'artifacts', 'playwright-results.json');
const DEFAULT_ROUTE_DESCRIPTION = 'Visits this route directly so the smoke spec can verify the page without relying on brittle click paths.';
const DEFAULT_ASSERTION_DESCRIPTION = 'Checks for stable UI text or controls before deeper automation is added.';

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
    ...COMMON_ROUTE_DESCRIPTIONS,
    '/security/module': 'Opens the Security Module so the spec can verify analysis, scan, correlation, and realtime controls.',
    '/ml/module': 'Opens the ML Module so the spec can verify training, scoring, explainability, and autonomy panels.',
    '/playwright/module': 'Opens the Playwright Module so the suite can verify the Playwright export surface.',
    '/injection-prevention/module': 'Opens the Injection Prevention Module so the suite can verify operator-key blocking, Mongoose hardening, and safe query templates.',
    '/xss-defense/module': 'Opens the XSS Defense Module so the suite can verify escaped rendering posture, strict CSP directives, and payload-evaluation controls.',
    '/access-control/module': 'Opens the Access Control Module so the suite can verify protected-by-default API coverage, identity posture, and server-side decision controls.',
    '/self-healing/module': 'Opens the Self-Healing Module so the suite can verify redirect handling, sample loading, and repair suggestion output.',
    '/session-management/module': 'Opens the Session Management Module so the suite can verify strict timeout posture, current session state, and lockdown-evaluation controls.',
    '/hardware-mfa/module': 'Opens the Hardware-First MFA Module so the suite can verify strong-factor step-up controls and current session assurance.',
    '/mission-assurance/module': 'Opens the Mission Assurance Module so the suite can verify RBAC plus ABAC policy evaluation and current-user access context.',
    '/locator-repair/module': 'Legacy entry point that should redirect to the canonical Self-Healing Module route before browser checks continue.'
};

const ASSERTION_DESCRIPTIONS = {
    ...COMMON_ASSERTION_DESCRIPTIONS,
    'Playwright module loads from the workspace entry point': 'Checks that the workspace link still opens the Playwright module successfully.',
    'Refresh Module button is present': 'Checks that the main refresh control is visible.',
    'Realtime server badge is visible': 'Checks that realtime availability is still surfaced in the UI.',
    'Train Hybrid Model button is present': 'Checks that the primary training action is visible.',
    'Selenium Module heading is visible': 'Confirms that navigation reached the Selenium module.',
    'Scenario Catalog panel is visible': 'Checks that the module still lists the available automation scenarios.',
    'Generated Script Preview panel is visible': 'Confirms that the Selenium preview panel is visible.',
    'Scenario selector is present': 'Checks that the user can switch scenarios in the module UI.',
    'Browser prerequisites render': 'Confirms that the module still lists the setup needed to run the exported suite.',
    'Playwright Module heading is visible': 'Confirms that navigation reached the Playwright module.',
    'Generated Spec Preview panel is visible': 'Confirms that the Playwright preview panel is visible.',
    'Playwright prerequisites render': 'Confirms that the page still lists the setup needed to run the exported spec.',
    'Injection Prevention Module card is present': 'Checks that the Research Workspace still exposes the Injection Prevention entry point.',
    'XSS Defense Module card is present': 'Checks that the Research Workspace still exposes the XSS Defense entry point.',
    'Access Control Module card is present': 'Checks that the Research Workspace still exposes the Access Control entry point.',
    'Injection Prevention Module heading is visible': 'Confirms that navigation reached the Injection Prevention module.',
    'Architectural controls are visible': 'Checks that the request guard, sanitizeFilter, and strictQuery posture render in the module UI.',
    'Structured query templates are visible': 'Confirms that the module still shows safe query-builder examples instead of raw request-driven filters.',
    'Prevention decision panel is visible': 'Checks that the module renders a server-side allow or reject decision for the selected request sample.',
    'Injection Prevention Module renders hardening controls': 'Confirms that the Injection Prevention page still renders its hardening posture, safe query patterns, and evaluation surface.',
    'XSS Defense Module heading is visible': 'Confirms that navigation reached the XSS Defense module.',
    'Escaped rendering controls are visible': 'Checks that the module surfaces escaped-template posture, sink discipline, and note-field sanitization guidance.',
    'CSP directives are visible': 'Confirms that the CSP directive set is rendered for review in the module UI.',
    'XSS decision panel is visible': 'Checks that the module renders an escaped-preview and CSP decision surface for the selected payload.',
    'XSS Defense Module renders CSP controls': 'Confirms that the XSS Defense page still renders escaped rendering posture, CSP directives, and evaluation controls.',
    'Access Control Module heading is visible': 'Confirms that navigation reached the Access Control module.',
    'Protected API catalog is visible': 'Checks that the module surfaces protected API route coverage and verification strategy.',
    'Current identity summary is visible': 'Confirms that the module renders the current authenticated server-side identity context.',
    'Server decision panel is visible': 'Checks that the module renders a server decision for the selected access-control scenario.',
    'Access Control Module renders protected API coverage': 'Confirms that the Access Control page still renders route coverage, identity posture, and decision controls.',
    'Legacy self-healing redirect resolves to the canonical route': 'Checks that the old locator-repair path still lands on the canonical Self-Healing Module URL.',
    'Self-Healing Module heading is visible': 'Confirms that navigation reached the Self-Healing module.',
    'Suggest Repairs button is present': 'Checks that the primary self-healing analysis action is visible.',
    'Repair Candidates panel is visible': 'Confirms that ranked repair suggestions render in the module UI.',
    'Generated self-healing suggestions render': 'Checks that loading a sample and re-running analysis produces ranked repair output.',
    'Self-Healing Module renders repair suggestions': 'Confirms that the Self-Healing page still renders sample-driven repair suggestions.',
    'Mission Assurance Module card is present': 'Checks that the Research Workspace still exposes the Mission Assurance entry point.',
    'Hardware-First MFA Module card is present': 'Checks that the Research Workspace still exposes the Hardware-First MFA entry point.',
    'Mission Assurance Module heading is visible': 'Confirms that navigation reached the Mission Assurance module.',
    'Policy Decision is visible': 'Checks that the policy-decision panel is visible for the selected mission action.',
    'RBAC is visible': 'Confirms that the module explains the role-based access portion of the decision.',
    'ABAC is visible': 'Confirms that the module explains the attribute-based access portion of the decision.',
    'Evaluate Decision button is present': 'Checks that the primary mission-policy evaluation control is visible.',
    'Hardware-First MFA Module heading is visible': 'Confirms that navigation reached the Hardware-First MFA module.',
    'Challenge And Verify is visible': 'Checks that the step-up challenge and verification workflow is rendered.',
    'Hardware token is visible': 'Confirms that hardware-token assurance remains part of the current MFA posture.',
    'PKI is visible': 'Confirms that PKI-backed assurance remains part of the module guidance and controls.',
    'Start Challenge button is present': 'Checks that the primary hardware-first challenge control is visible.',
    'Session Management Module card is present': 'Checks that the Research Workspace still exposes the Session Management entry point.',
    'Session Management Module heading is visible': 'Confirms that navigation reached the Session Management module.',
    'Live session summary is visible': 'Checks that the page surfaces the current server-side session state.',
    'Lockdown evaluation controls are visible': 'Checks that the timeout and concurrent-login evaluation form is visible.',
    'Lockdown decision panel is visible': 'Confirms that the module renders a server-side lockdown decision summary.',
    'Session Management Module renders lockdown controls': 'Confirms that the Session Management page renders session-state and lockdown-evaluation controls.',
    'Hardware-First MFA Module renders step-up controls': 'Confirms that the Hardware-First MFA page renders challenge, verify, and revoke controls.',
    'Mission Assurance Module renders policy evaluator': 'Confirms that the Mission Assurance page renders its policy-decision controls and current session context.',
    'Scenario selector updates the generated spec': 'Checks that changing the selected scenario refreshes the generated Playwright preview.',
    'Load Spec button refreshes the preview': 'Checks that the explicit Load Spec control reloads the selected template.',
    'Refresh Module button reloads the overview': 'Checks that the module refresh action reloads metadata and leaves the page ready to use.',
    'Cross-module navigation buttons remain available': 'Checks that the module still links back into the rest of the Research workflow.',
    'Security Module renders its main controls': 'Checks that the Security page still renders its primary controls.',
    'ML Module renders training and autonomy panels': 'Checks that the ML page still renders its training and autonomy panels.',
    'Selenium Module renders a script preview': 'Confirms that the Selenium export surface still shows a script preview.',
    'Playwright Module renders a spec preview': 'Confirms that the Playwright export surface still shows a spec preview.'
};

const TAG_DESCRIPTIONS = {
    ...COMMON_TAG_DESCRIPTIONS,
    selenium: 'Covers the Selenium export surface.',
    'access-control': 'Covers server-side identity verification and broken-access-control prevention.',
    'xss-defense': 'Covers the escaped-rendering and CSP assurance workspace.',
    'self-healing': 'Covers the Self-Healing locator-repair workspace.',
    playwright: 'Covers the Playwright export surface.'
};

function describeRoutePath(routePath) {
    return ROUTE_DESCRIPTIONS[routePath] || DEFAULT_ROUTE_DESCRIPTION;
}

function describeAssertion(assertion) {
    return ASSERTION_DESCRIPTIONS[assertion] || DEFAULT_ASSERTION_DESCRIPTION;
}

function describeTag(tag) {
    return TAG_DESCRIPTIONS[tag] || 'Highlights the kind of browser check this scenario covers.';
}

function buildScenarioFunctionDescription(scenario) {
    const routeLabel = scenario.routes.length === 1 ? 'route' : 'routes';
    return `${scenario.title} is a smoke path across ${scenario.routes.length} ${routeLabel} with stable, visible checks.`;
}

function getScenarioIds() {
    return listPlaywrightScenarios().map((scenario) => scenario.id);
}

function getScenarioDefinition(scenarioId = DEFAULT_SCENARIO_ID) {
    const normalizedId = typeof scenarioId === 'string' && scenarioId.trim()
        ? scenarioId.trim()
        : DEFAULT_SCENARIO_ID;

    return getPlaywrightScenario(normalizedId);
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

function normalizeRunStatus(status) {
    switch (status) {
        case 'passed':
            return 'passed';
        case 'failed':
        case 'timedOut':
        case 'interrupted':
            return 'failed';
        case 'flaky':
            return 'flaky';
        case 'skipped':
            return 'skipped';
        default:
            return 'unknown';
    }
}

function summarizeAggregateStatus(currentStatus, nextStatus) {
    const severity = {
        failed: 4,
        flaky: 3,
        passed: 2,
        skipped: 1,
        unknown: 0
    };

    return severity[nextStatus] > severity[currentStatus] ? nextStatus : currentStatus;
}

function walkSuiteTree(entries, visitSpec) {
    if (!Array.isArray(entries)) {
        return;
    }

    entries.forEach((entry) => {
        if (Array.isArray(entry.specs)) {
            entry.specs.forEach((spec) => visitSpec(spec, entry));
        }

        if (Array.isArray(entry.suites)) {
            walkSuiteTree(entry.suites, visitSpec);
        }
    });
}

function buildLatestRunSummary(reportPath = PLAYWRIGHT_RESULTS_PATH) {
    const cachedArtifact = readCachedJsonArtifact(reportPath);

    if (!cachedArtifact.exists) {
        return {
            available: false,
            status: 'unavailable',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            flaky: 0,
            durationMs: 0,
            generatedAt: '',
            sourcePath: 'artifacts/playwright-results.json',
            projects: [],
            scenarioResults: []
        };
    }

    if (cachedArtifact.error) {
        return {
            available: false,
            status: 'unavailable',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            flaky: 0,
            durationMs: 0,
            generatedAt: '',
            sourcePath: 'artifacts/playwright-results.json',
            error: cachedArtifact.error.message,
            projects: [],
            scenarioResults: []
        };
    }

    try {
        const report = cachedArtifact.report;
        const stats = report && report.stats ? report.stats : {};
        const fileStats = cachedArtifact.fileStats;
        const projects = new Map();
        const scenarioResults = [];
        const summary = {
            available: true,
            status: 'unknown',
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            flaky: 0,
            durationMs: typeof stats.duration === 'number' ? stats.duration : 0,
            generatedAt: stats.startTime || fileStats.mtime.toISOString(),
            sourcePath: 'artifacts/playwright-results.json'
        };

        walkSuiteTree(report.suites, (spec) => {
            const tests = Array.isArray(spec.tests) ? spec.tests : [];

            tests.forEach((testEntry) => {
                const results = Array.isArray(testEntry.results) ? testEntry.results : [];
                const latestResult = results.length ? results[results.length - 1] : null;
                const normalizedStatus = normalizeRunStatus(latestResult && latestResult.status);
                const projectName = testEntry.projectName || 'unknown';
                const annotations = Array.isArray(testEntry.annotations) ? testEntry.annotations : [];
                const scenarioAnnotation = annotations.find((annotation) => annotation.type === 'playwright-scenario');

                summary.total += 1;
                summary.status = summarizeAggregateStatus(summary.status, normalizedStatus);

                if (normalizedStatus === 'passed') {
                    summary.passed += 1;
                } else if (normalizedStatus === 'failed') {
                    summary.failed += 1;
                } else if (normalizedStatus === 'flaky') {
                    summary.flaky += 1;
                } else if (normalizedStatus === 'skipped') {
                    summary.skipped += 1;
                }

                const projectSummary = projects.get(projectName) || {
                    name: projectName,
                    total: 0,
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    flaky: 0,
                    status: 'unknown'
                };

                projectSummary.total += 1;
                projectSummary.status = summarizeAggregateStatus(projectSummary.status, normalizedStatus);

                if (normalizedStatus === 'passed') {
                    projectSummary.passed += 1;
                } else if (normalizedStatus === 'failed') {
                    projectSummary.failed += 1;
                } else if (normalizedStatus === 'flaky') {
                    projectSummary.flaky += 1;
                } else if (normalizedStatus === 'skipped') {
                    projectSummary.skipped += 1;
                }

                projects.set(projectName, projectSummary);

                scenarioResults.push({
                    scenarioId: scenarioAnnotation && typeof scenarioAnnotation.description === 'string'
                        ? scenarioAnnotation.description
                        : '',
                    title: spec.title || '',
                    file: spec.file || '',
                    projectName,
                    status: normalizedStatus,
                    durationMs: latestResult && typeof latestResult.duration === 'number' ? latestResult.duration : 0
                });
            });
        });

        return {
            ...summary,
            projects: Array.from(projects.values()),
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
            flaky: 0,
            durationMs: 0,
            generatedAt: '',
            sourcePath: 'artifacts/playwright-results.json',
            error: error.message,
            projects: [],
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
            projectNames: [],
            generatedAt: latestRun.generatedAt || ''
        };

        current.status = summarizeAggregateStatus(current.status, result.status || 'unknown');
        if (result.projectName && !current.projectNames.includes(result.projectName)) {
            current.projectNames.push(result.projectName);
        }

        index.set(result.scenarioId, current);
    });

    return index;
}

function buildPlaywrightModuleOverview({ baseUrl } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const latestRun = buildLatestRunSummary();
    const scenarioRunIndex = buildScenarioRunIndex(latestRun);
    const scenarios = buildScenarioCatalog({
        baseUrl: normalizedBaseUrl,
        listScenarios: listPlaywrightScenarios,
        describeRoutePath,
        describeAssertion,
        describeTag,
        buildScenarioFunctionDescription
    }).map((scenario) => {
        const latestScenarioRun = scenarioRunIndex.get(scenario.id);

        return {
            ...scenario,
            latestRunStatus: latestScenarioRun ? latestScenarioRun.status : 'unknown',
            latestRunProjects: latestScenarioRun ? [...latestScenarioRun.projectNames] : []
        };
    });
    const suiteFiles = collectSuiteFiles(listPlaywrightScenarios);

    return {
        module: {
            name: 'Playwright Module',
            runtime: 'JavaScript + @playwright/test',
            targetBrowser: 'Chromium, Firefox, and WebKit',
            exportStyle: 'Generated starter spec',
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
        'await page.goto(`${baseUrl}/auth/login`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Login\');',
        'await expect(page.locator(\'form[action="/auth/login"]\')).toBeVisible();',
        'await expect(page.locator(\'#email\')).toHaveAttribute(\'type\', \'email\');',
        'await expect(page.locator(\'#password\')).toHaveAttribute(\'type\', \'password\');'
    ].join('\n    '),
    'auth-signup-form': [
        'await page.goto(`${baseUrl}/auth/signup`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Sign Up\');',
        'await expect(page.locator(\'form[action="/auth/signup"]\')).toBeVisible();',
        'await expect(page.locator(\'#password\')).toHaveAttribute(\'minlength\', \'8\');',
        'await expectBodyText(page, \'Password requirements:\');'
    ].join('\n    '),
    'auth-signup-login-flow': [
        'await page.goto(`${baseUrl}/auth/signup`, { waitUntil: \'domcontentloaded\' });',
        'await page.locator(\'#email\').fill(email);',
        'await page.locator(\'#password\').fill(password);',
        'await Promise.all([',
        '    page.waitForURL(/\\/auth\\/login$/),',
        '    page.getByRole(\'button\', { name: \'Sign Up\' }).click()',
        ']);',
        'await signIn(page);',
        'await expectBodyText(page, \'Notes\');'
    ].join('\n    '),
    'research-playwright-entry-flow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Playwright Module\');',
        'await page.locator(\'a[href="/playwright/module"]\').click();',
        'await expect(page).toHaveURL(`${baseUrl}/playwright/module`);'
    ].join('\n    '),
    'workspace-navigation': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Security Module\');',
        'await expectBodyText(page, \'ML Module\');',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expectBodyText(page, \'Playwright Module\');',
        'await expectBodyText(page, \'Injection Prevention Module\');',
        'await expectBodyText(page, \'XSS Defense Module\');',
        'await expectBodyText(page, \'Access Control Module\');',
        'await expectBodyText(page, \'Self-Healing Module\');',
        'await expectBodyText(page, \'Session Management Module\');',
        'await expectBodyText(page, \'Hardware-First MFA Module\');',
        'await expectBodyText(page, \'Mission Assurance Module\');'
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
    'injection-prevention-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/injection-prevention/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Injection Prevention Module\');',
        'await expect(page.locator(\'#injection-prevention-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Architectural Controls\');',
        'await expectBodyText(page, \'Structured Query Templates\');',
        'await expect(page.locator(\'#injection-prevention-evaluation\')).toContainText(\'Prevention Decision\');'
    ].join('\n    '),
    'xss-defense-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/xss-defense/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'XSS Defense Module\');',
        'await expect(page.locator(\'#xss-defense-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Rendering And Header Controls\');',
        'await expectBodyText(page, \'Directive Set\');',
        'await expect(page.locator(\'#xss-defense-evaluation\')).toContainText(\'Escaped Preview\');'
    ].join('\n    '),
    'access-control-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/access-control/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Access Control Module\');',
        'await expect(page.locator(\'#access-control-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Protected API Catalog\');',
        'await expectBodyText(page, \'Verified Server Context\');',
        'await expect(page.locator(\'#access-control-evaluation\')).toContainText(\'Route\');'
    ].join('\n    '),
    'self-healing-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/locator-repair/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page).toHaveURL(`${baseUrl}/self-healing/module`);',
        'await expectBodyText(page, \'Self-Healing Module\');',
        'await expect(page.locator(\'#locator-repair-sample-select\')).toBeVisible();',
        'await expect(page.locator(\'#locator-repair-analyze-btn\')).toBeVisible();',
        'await page.locator(\'#locator-repair-sample-select\').selectOption(\'locator-analyze-button-drift\');',
        'await page.locator(\'#locator-repair-load-sample-btn\').click();',
        'await page.locator(\'#locator-repair-analyze-btn\').click();',
        'await expectBodyText(page, \'Generated ML-assisted self-healing suggestions.\');',
        'await expect(page.locator(\'#locator-repair-suggestions\')).toContainText(\'data-testid\');'
    ].join('\n    '),
    'mission-assurance-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/mission-assurance/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Mission Assurance Module\');',
        'await expect(page.locator(\'#mission-assurance-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Policy Decision\');',
        'await expectBodyText(page, \'RBAC\');',
        'await expectBodyText(page, \'ABAC\');'
    ].join('\n    '),
    'hardware-mfa-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/hardware-mfa/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Hardware-First MFA Module\');',
        'await expect(page.locator(\'#hardware-mfa-start-btn\')).toBeVisible();',
        'await expect(page.locator(\'#hardware-mfa-verify-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Challenge And Verify\');',
        'await expectBodyText(page, \'Hardware token\');',
        'await expectBodyText(page, \'PKI\');'
    ].join('\n    '),
    'session-management-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/session-management/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Session Management Module\');',
        'await expect(page.locator(\'#session-management-summary\')).toContainText(\'Network zone\');',
        'await expect(page.locator(\'#session-management-scenario-select\')).toBeVisible();',
        'await expect(page.locator(\'#session-management-evaluate-btn\')).toBeVisible();',
        'await expect(page.locator(\'#session-management-evaluation\')).toContainText(\'Lockdown Decision\');'
    ].join('\n    '),
    'notes-crud-workflow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/notes/new`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Create Note\');',
        'await page.locator(\'#title\').fill(\'Playwright CRUD note\');',
        'await page.locator(\'#content\').fill(\'Created through the server-rendered notes flow.\');',
        'await Promise.all([',
        '    page.waitForURL(/\\/notes$/),',
        '    page.getByRole(\'button\', { name: \'Create Note\' }).click()',
        ']);',
        'await expectBodyText(page, \'Playwright CRUD note\');'
    ].join('\n    '),
    'security-module-workflow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page.locator(\'#workspace-refresh-all\')).toBeVisible();',
        'await page.locator(\'#workspace-load-sample-log\').click();',
        'await expect(page.locator(\'#workspace-log-text\')).toHaveValue(/POST \\/auth\\/login 401/);',
        'await page.locator(\'#workspace-log-form button[type="submit"]\').click();',
        'await expectBodyText(page, \'alert(s) created\');',
        'await page.locator(\'#workspace-load-sample-scan\').click();',
        'await expect(page.locator(\'#workspace-scan-text\')).toHaveValue(/Nikto v2\\.1\\.6/);',
        'await page.locator(\'#workspace-scan-form button[type="submit"]\').click();',
        'await expectBodyText(page, \'Scan imported with\');',
        'await page.locator(\'#workspace-inject-correlation-demo\').click();',
        'await expectBodyText(page, \'Injected\');'
    ].join('\n    '),
    'playwright-module-interactions': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page.locator(\'#playwright-scenario-select\')).toBeVisible();',
        'await page.locator(\'#playwright-scenario-select\').selectOption(\'security-module-workflow\');',
        'await expect(page.locator(\'#playwright-script-file-badge\')).toContainText(\'playwright-security-module-workflow.spec.js\');',
        'await page.locator(\'#playwright-load-script-btn\').click();',
        'await expectBodyText(page, \'Loaded the selected spec.\');',
        'await page.locator(\'#playwright-refresh-btn\').click();',
        'await expectBodyText(page, \'Playwright module refreshed.\');',
        'await page.locator(\'a[href="/security/module"]\').click();',
        'await expect(page).toHaveURL(`${baseUrl}/security/module`);'
    ].join('\n    '),
    'research-full-suite': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Selenium Module\');',
        'await expectBodyText(page, \'Playwright Module\');',
        'await expectBodyText(page, \'Injection Prevention Module\');',
        'await expectBodyText(page, \'XSS Defense Module\');',
        'await expectBodyText(page, \'Access Control Module\');',
        'await expectBodyText(page, \'Self-Healing Module\');',
        'await expectBodyText(page, \'Session Management Module\');',
        'await expectBodyText(page, \'Hardware-First MFA Module\');',
        'await expectBodyText(page, \'Mission Assurance Module\');',
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
        'await expectBodyText(page, \'Generated Spec Preview\');',
        '',
        'await page.goto(`${baseUrl}/injection-prevention/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Injection Prevention Module\');',
        'await expect(page.locator(\'#injection-prevention-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Prevention Decision\');',
        '',
        'await page.goto(`${baseUrl}/xss-defense/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'XSS Defense Module\');',
        'await expect(page.locator(\'#xss-defense-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Escaping And CSP Outcome\');',
        '',
        'await page.goto(`${baseUrl}/access-control/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Access Control Module\');',
        'await expect(page.locator(\'#access-control-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Server Decision\');',
        '',
        'await page.goto(`${baseUrl}/self-healing/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Self-Healing Module\');',
        'await expect(page.locator(\'#locator-repair-analyze-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Repair Candidates\');',
        '',
        'await page.goto(`${baseUrl}/session-management/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Session Management Module\');',
        'await expect(page.locator(\'#session-management-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Lockdown Decision\');',
        '',
        'await page.goto(`${baseUrl}/hardware-mfa/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Hardware-First MFA Module\');',
        'await expect(page.locator(\'#hardware-mfa-start-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Challenge And Verify\');',
        '',
        'await page.goto(`${baseUrl}/mission-assurance/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Mission Assurance Module\');',
        'await expect(page.locator(\'#mission-assurance-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Policy Decision\');'
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
const password = process.env.PLAYWRIGHT_TEST_PASSWORD || process.env.DEV_SEED_PASSWORD || '';

async function expectBodyText(page, text) {
    await expect(page.locator('body')).toContainText(text);
}

async function signIn(page) {
    if (!password) {
        throw new Error('Set PLAYWRIGHT_TEST_PASSWORD or DEV_SEED_PASSWORD before running protected-route Playwright specs.');
    }

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
    return buildScriptMetadata({
        baseUrl: normalizedBaseUrl,
        scenario,
        describeRoutePath,
        describeAssertion,
        describeTag,
        buildScenarioFunctionDescription,
        usageNotes: buildScriptUsageNotes(`playwright-${scenario.id}.spec.js`),
        content: buildScriptTemplate(normalizedBaseUrl, scenario),
        extra: {
            fileName: `playwright-${scenario.id}.spec.js`,
            language: 'javascript',
            runtime: '@playwright/test',
            baseUrl: normalizedBaseUrl
        }
    });
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildPlaywrightModuleOverview,
    buildLatestRunSummary,
    buildPlaywrightScript,
    getScenarioIds
};
