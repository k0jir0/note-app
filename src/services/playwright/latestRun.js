const path = require('path');

const { readCachedJsonArtifact } = require('../browserArtifactCache');

const PLAYWRIGHT_RESULTS_PATH = path.join(process.cwd(), 'artifacts', 'playwright-results.json');

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

function buildUnavailableLatestRun(error) {
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
        ...(error ? { error } : {}),
        projects: [],
        scenarioResults: []
    };
}

function buildLatestRunSummary(reportPath = PLAYWRIGHT_RESULTS_PATH) {
    const cachedArtifact = readCachedJsonArtifact(reportPath);

    if (!cachedArtifact.exists) {
        return buildUnavailableLatestRun();
    }

    if (cachedArtifact.error) {
        return buildUnavailableLatestRun(cachedArtifact.error.message);
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
        return buildUnavailableLatestRun(error.message);
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

module.exports = {
    buildLatestRunSummary,
    buildScenarioRunIndex
};
