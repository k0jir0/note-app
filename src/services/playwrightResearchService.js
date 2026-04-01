const {
    DEFAULT_SCENARIO_ID,
    CONTROL_DEFINITIONS,
    buildControlGuide,
    buildCoverageSummary,
    buildPlaywrightScenarios,
    buildPrerequisites,
    buildWorkflow,
    collectSuiteFiles,
    getScenarioIds,
    normalizeBaseUrl
} = require('./playwright/descriptors');
const { buildLatestRunSummary, buildScenarioRunIndex } = require('./playwright/latestRun');
const { buildPlaywrightScript } = require('./playwright/scriptBuilder');

function buildPlaywrightModuleOverview({ baseUrl } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const latestRun = buildLatestRunSummary();
    const scenarios = buildPlaywrightScenarios({
        baseUrl: normalizedBaseUrl,
        latestRun,
        buildScenarioRunIndex
    });
    const suiteFiles = collectSuiteFiles(require('../lib/playwrightScenarioRegistry').listPlaywrightScenarios);

    return {
        module: {
            name: 'Playwright Testing Module',
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

module.exports = {
    DEFAULT_SCENARIO_ID,
    buildPlaywrightModuleOverview,
    buildLatestRunSummary,
    buildPlaywrightScript,
    getScenarioIds
};
