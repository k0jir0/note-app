const {
    DEFAULT_PLAYWRIGHT_SCENARIO_ID,
    getPlaywrightScenario,
    listPlaywrightScenarios
} = require('../../lib/playwrightScenarioRegistry');
const {
    COMMON_ASSERTION_DESCRIPTIONS,
    COMMON_ROUTE_DESCRIPTIONS,
    COMMON_TAG_DESCRIPTIONS,
    buildControlGuide,
    buildCoverageSummary,
    buildScenarioCatalog,
    collectSuiteFiles,
    normalizeBaseUrl
} = require('../browserResearchModuleShared');

const DEFAULT_SCENARIO_ID = DEFAULT_PLAYWRIGHT_SCENARIO_ID;
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
    '/security/module': 'Opens the Security Operations Module so the spec can verify analysis, scan, correlation, and realtime controls.',
    '/ml/module': 'Opens the Alert Triage ML Module so the spec can verify training, scoring, explainability, and autonomy panels.',
    '/playwright/module': 'Opens the Playwright Testing Module so the suite can verify the Playwright export surface.',
    '/injection-prevention/module': 'Opens the Query Injection Prevention Module so the suite can verify operator-key blocking, Mongoose hardening, and safe query templates.',
    '/xss-defense/module': 'Opens the XSS and CSP Defense Module so the suite can verify escaped rendering posture, strict CSP directives, and payload-evaluation controls.',
    '/access-control/module': 'Opens the Server Access Control Module so the suite can verify protected-by-default API coverage, identity posture, and server-side decision controls.',
    '/self-healing/module': 'Opens the Self-Healing Locator Repair Module so the suite can verify redirect handling, sample loading, and repair suggestion output.',
    '/session-management/module': 'Opens the Session Security Module so the suite can verify strict timeout posture, current session state, and lockdown-evaluation controls.',
    '/hardware-mfa/module': 'Opens the Hardware-Backed MFA Module so the suite can verify strong-factor step-up controls and current session assurance.',
    '/mission-assurance/module': 'Opens the Mission Access Assurance Module so the suite can verify RBAC plus ABAC policy evaluation and current-user access context.',
    '/locator-repair/module': 'Legacy entry point that should redirect to the canonical Self-Healing Locator Repair Module route before browser checks continue.'
};

const ASSERTION_DESCRIPTIONS = {
    ...COMMON_ASSERTION_DESCRIPTIONS,
    'Playwright module loads from the workspace entry point': 'Checks that the workspace link still opens the Playwright Testing Module successfully.',
    'Refresh Module button is present': 'Checks that the main refresh control is visible.',
    'Realtime server badge is visible': 'Checks that realtime availability is still surfaced in the UI.',
    'Train Hybrid Model button is present': 'Checks that the primary training action is visible.',
    'Selenium Module heading is visible': 'Confirms that navigation reached the Selenium Testing module.',
    'Scenario Catalog panel is visible': 'Checks that the module still lists the available automation scenarios.',
    'Generated Script Preview panel is visible': 'Confirms that the Selenium preview panel is visible.',
    'Scenario selector is present': 'Checks that the user can switch scenarios in the module UI.',
    'Browser prerequisites render': 'Confirms that the module still lists the setup needed to run the exported suite.',
    'Playwright Module heading is visible': 'Confirms that navigation reached the Playwright Testing module.',
    'Generated Spec Preview panel is visible': 'Confirms that the Playwright preview panel is visible.',
    'Playwright prerequisites render': 'Confirms that the page still lists the setup needed to run the exported spec.',
    'Injection Prevention Module card is present': 'Checks that the Research Workspace still exposes the Query Injection Prevention entry point.',
    'XSS Defense Module card is present': 'Checks that the Research Workspace still exposes the XSS and CSP Defense entry point.',
    'Access Control Module card is present': 'Checks that the Research Workspace still exposes the Server Access Control entry point.',
    'Injection Prevention Module heading is visible': 'Confirms that navigation reached the Query Injection Prevention module.',
    'Architectural controls are visible': 'Checks that the request guard, sanitizeFilter, and strictQuery posture render in the module UI.',
    'Structured query templates are visible': 'Confirms that the module still shows safe query-builder examples instead of raw request-driven filters.',
    'Prevention decision panel is visible': 'Checks that the module renders a server-side allow or reject decision for the selected request sample.',
    'Injection Prevention Module renders hardening controls': 'Confirms that the Query Injection Prevention page still renders its hardening posture, safe query patterns, and evaluation surface.',
    'XSS Defense Module heading is visible': 'Confirms that navigation reached the XSS and CSP Defense module.',
    'Escaped rendering controls are visible': 'Checks that the module surfaces escaped-template posture, sink discipline, and note-field sanitization guidance.',
    'CSP directives are visible': 'Confirms that the CSP directive set is rendered for review in the module UI.',
    'XSS decision panel is visible': 'Checks that the module renders an escaped-preview and CSP decision surface for the selected payload.',
    'XSS Defense Module renders CSP controls': 'Confirms that the XSS and CSP Defense page still renders escaped rendering posture, CSP directives, and evaluation controls.',
    'Access Control Module heading is visible': 'Confirms that navigation reached the Server Access Control module.',
    'Protected API catalog is visible': 'Checks that the module surfaces protected API route coverage and verification strategy.',
    'Current identity summary is visible': 'Confirms that the module renders the current authenticated server-side identity context.',
    'Server decision panel is visible': 'Checks that the module renders a server decision for the selected access-control scenario.',
    'Access Control Module renders protected API coverage': 'Confirms that the Server Access Control page still renders route coverage, identity posture, and decision controls.',
    'Legacy self-healing redirect resolves to the canonical route': 'Checks that the old locator-repair path still lands on the canonical Self-Healing Locator Repair Module URL.',
    'Self-Healing Module heading is visible': 'Confirms that navigation reached the Self-Healing Locator Repair module.',
    'Suggest Repairs button is present': 'Checks that the primary self-healing analysis action is visible.',
    'Repair Candidates panel is visible': 'Confirms that ranked repair suggestions render in the module UI.',
    'Generated self-healing suggestions render': 'Checks that loading a sample and re-running analysis produces ranked repair output.',
    'Self-Healing Module renders repair suggestions': 'Confirms that the Self-Healing Locator Repair page still renders sample-driven repair suggestions.',
    'Mission Assurance Module card is present': 'Checks that the Research Workspace still exposes the Mission Access Assurance entry point.',
    'Hardware-First MFA Module card is present': 'Checks that the Research Workspace still exposes the Hardware-Backed MFA entry point.',
    'Mission Assurance Module heading is visible': 'Confirms that navigation reached the Mission Access Assurance module.',
    'Policy Decision is visible': 'Checks that the policy-decision panel is visible for the selected mission action.',
    'RBAC is visible': 'Confirms that the module explains the role-based access portion of the decision.',
    'ABAC is visible': 'Confirms that the module explains the attribute-based access portion of the decision.',
    'Evaluate Decision button is present': 'Checks that the primary mission-policy evaluation control is visible.',
    'Hardware-First MFA Module heading is visible': 'Confirms that navigation reached the Hardware-Backed MFA module.',
    'Challenge And Verify is visible': 'Checks that the step-up challenge and verification workflow is rendered.',
    'Hardware token is visible': 'Confirms that hardware-token assurance remains part of the current MFA posture.',
    'PKI is visible': 'Confirms that PKI-backed assurance remains part of the module guidance and controls.',
    'Start Challenge button is present': 'Checks that the primary hardware-first challenge control is visible.',
    'Session Management Module card is present': 'Checks that the Research Workspace still exposes the Session Security entry point.',
    'Session Management Module heading is visible': 'Confirms that navigation reached the Session Security module.',
    'Live session summary is visible': 'Checks that the page surfaces the current server-side session state.',
    'Lockdown evaluation controls are visible': 'Checks that the timeout and concurrent-login evaluation form is visible.',
    'Lockdown decision panel is visible': 'Confirms that the module renders a server-side lockdown decision summary.',
    'Session Management Module renders lockdown controls': 'Confirms that the Session Security page renders session-state and lockdown-evaluation controls.',
    'Hardware-First MFA Module renders step-up controls': 'Confirms that the Hardware-Backed MFA page renders challenge, verify, and revoke controls.',
    'Mission Assurance Module renders policy evaluator': 'Confirms that the Mission Access Assurance page renders its policy-decision controls and current session context.',
    'Scenario selector updates the generated spec': 'Checks that changing the selected scenario refreshes the generated Playwright preview.',
    'Load Spec button refreshes the preview': 'Checks that the explicit Load Spec control reloads the selected template.',
    'Refresh Module button reloads the overview': 'Checks that the module refresh action reloads metadata and leaves the page ready to use.',
    'Cross-module navigation buttons remain available': 'Checks that the module still links back into the rest of the Research workflow.',
    'Security Module renders its main controls': 'Checks that the Security Operations page still renders its primary controls.',
    'ML Module renders training and autonomy panels': 'Checks that the Alert Triage ML page still renders its training and autonomy panels.',
    'Selenium Module renders a script preview': 'Confirms that the Selenium Testing export surface still shows a script preview.',
    'Playwright Module renders a spec preview': 'Confirms that the Playwright Testing export surface still shows a spec preview.'
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

function buildPlaywrightScenarios({ baseUrl, latestRun, buildScenarioRunIndex } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarioRunIndex = buildScenarioRunIndex(latestRun);
    return buildScenarioCatalog({
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
}

module.exports = {
    DEFAULT_SCENARIO_ID,
    CONTROL_DEFINITIONS,
    buildCoverageSummary,
    buildControlGuide,
    buildPlaywrightScenarios,
    buildPrerequisites,
    buildScenarioFunctionDescription,
    buildWorkflow,
    collectSuiteFiles,
    describeAssertion,
    describeRoutePath,
    describeTag,
    getScenarioDefinition,
    getScenarioIds,
    normalizeBaseUrl
};
