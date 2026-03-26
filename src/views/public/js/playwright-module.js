const {
    createModuleController,
    escapeHtml,
    formatDateTime,
    getRunTone
} = window.BrowserResearchModuleShared;

const runtimeLabelEl = document.getElementById('playwright-runtime-label');
const scenarioCountEl = document.getElementById('playwright-scenario-count');
const authCountEl = document.getElementById('playwright-auth-count');
const baseUrlEl = document.getElementById('playwright-base-url');
const controlsGuideEl = document.getElementById('playwright-controls-guide');
const workflowGrid = document.getElementById('playwright-workflow-grid');
const prerequisitesGrid = document.getElementById('playwright-prerequisites-grid');
const scenariosGrid = document.getElementById('playwright-scenarios-grid');
const suiteImplementedCountEl = document.getElementById('playwright-suite-implemented-count');
const latestRunStatusEl = document.getElementById('playwright-latest-run-status');
const latestRunGeneratedAtEl = document.getElementById('playwright-latest-run-generated-at');
const latestRunSummaryEl = document.getElementById('playwright-latest-run-summary');
const suiteFilesEl = document.getElementById('playwright-suite-files');
const scriptSummaryEl = document.getElementById('playwright-script-summary');
const scriptFileBadgeEl = document.getElementById('playwright-script-file-badge');
const scriptCodeEl = document.getElementById('playwright-script-code');

function renderWorkflow(items = []) {
    if (!workflowGrid) {
        return;
    }

    if (!items.length) {
        workflowGrid.innerHTML = '<div class="alert alert-secondary mb-0">No workflow steps are available right now.</div>';
        return;
    }

    workflowGrid.innerHTML = items.map((item) => `
        <div class="playwright-workflow-step">
            <p class="research-kicker mb-2">${escapeHtml(item.label)}</p>
            <p class="mb-0 text-muted">${escapeHtml(item.description)}</p>
        </div>
    `).join('');
}

function renderControls(items = []) {
    if (!controlsGuideEl) {
        return;
    }

    if (!items.length) {
        controlsGuideEl.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No control descriptions are available right now.</div></div>';
        return;
    }

    controlsGuideEl.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <p class="fw-semibold mb-0">${escapeHtml(item.label)}</p>
                    <span class="badge text-bg-light">${escapeHtml(item.id)}</span>
                </div>
                <p class="text-muted mb-2">${escapeHtml(item.description)}</p>
                <p class="small mb-0">${escapeHtml(item.interaction)}</p>
            </div>
        </div>
    `).join('');
}

function renderPrerequisites(items = []) {
    if (!prerequisitesGrid) {
        return;
    }

    if (!items.length) {
        prerequisitesGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No prerequisites are available right now.</div></div>';
        return;
    }

    prerequisitesGrid.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <p class="fw-semibold mb-0">${escapeHtml(item.label)}</p>
                    <span class="badge text-bg-${item.required ? 'dark' : 'secondary'}">${item.required ? 'Required' : 'Optional'}</span>
                </div>
                <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');
}

function renderScenarioCards(items = []) {
    if (!scenariosGrid) {
        return;
    }

    if (!items.length) {
        scenariosGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No scenarios are available right now.</div></div>';
        return;
    }

    scenariosGrid.innerHTML = items.map((scenario) => `
        <div class="col-xl-6">
            <div class="playwright-scenario-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <div>
                        <p class="research-kicker mb-1">${escapeHtml(scenario.id)}</p>
                        <h3 class="h5 mb-1">${escapeHtml(scenario.title)}</h3>
                    </div>
                    <div class="d-flex gap-2 flex-wrap justify-content-end">
                        <span class="badge text-bg-${scenario.requiresLogin ? 'info' : 'secondary'}">${scenario.requiresLogin ? 'Auth required' : 'Public flow'}</span>
                        <span class="badge text-bg-${getRunTone(scenario.latestRunStatus)}">${escapeHtml(scenario.latestRunStatus === 'unknown' ? 'Run status unavailable' : `Latest run: ${scenario.latestRunStatus}`)}</span>
                    </div>
                </div>
                <p class="text-muted mb-3">${escapeHtml(scenario.purpose)}</p>
                <p class="small mb-3">${escapeHtml(scenario.functionDescription || '')}</p>
                <p class="text-muted small mb-3">${escapeHtml(scenario.latestRunProjects && scenario.latestRunProjects.length ? `Reported by: ${scenario.latestRunProjects.join(', ')}` : 'No scenario-level run data is available yet.')}</p>
                <p class="fw-semibold mb-2">Tags</p>
                <div class="mb-3">
                    ${scenario.tagDetails.map((tag) => `
                        <div class="mb-2">
                            <span class="playwright-tag">${escapeHtml(tag.label)}</span>
                            <p class="text-muted small mb-0 mt-1">${escapeHtml(tag.description)}</p>
                        </div>
                    `).join('')}
                </div>
                <p class="fw-semibold mb-2">Route targets</p>
                <ul class="mb-3">
                    ${scenario.routeTargets.map((routeTarget) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(routeTarget.path)}</span>
                            <div>${escapeHtml(routeTarget.description)}</div>
                        </li>
                    `).join('')}
                </ul>
                <p class="fw-semibold mb-2">Assertions</p>
                <ul class="mb-3">
                    ${scenario.assertionDetails.map((assertion) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(assertion.label)}</span>
                            <div>${escapeHtml(assertion.description)}</div>
                        </li>
                    `).join('')}
                </ul>
                <p class="fw-semibold mb-2">Optional setup</p>
                <ul class="mb-0">
                    ${(scenario.optionalDependencies && scenario.optionalDependencies.length
        ? scenario.optionalDependencies
        : ['No optional setup is required beyond the standard Playwright project.']).map((dependency) => `
                        <li class="text-muted small">${escapeHtml(dependency)}</li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

function renderScenarioSummary(script) {
    if (!scriptSummaryEl) {
        return;
    }

    if (!script) {
        scriptSummaryEl.innerHTML = '<div class="alert alert-secondary mb-0">Select a scenario to see its spec summary.</div>';
        return;
    }

    scriptSummaryEl.innerHTML = `
        <div class="mb-3">
            <p class="text-muted mb-0">${escapeHtml(script.functionDescription || script.purpose || '')}</p>
        </div>
        <div class="d-flex flex-column gap-3">
            <div>
                <p class="fw-semibold mb-1">Scenario</p>
                <p class="mb-1">${escapeHtml(script.title)}</p>
                <p class="text-muted small mb-0">The smoke path represented by this exported spec.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">File name</p>
                <p class="mb-1">${escapeHtml(script.fileName)}</p>
                <p class="text-muted small mb-0">Suggested file name for a Playwright project.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Language and runtime</p>
                <p class="mb-1">${escapeHtml(script.language)} / ${escapeHtml(script.runtime)}</p>
                <p class="text-muted small mb-0">Format used by the exported template.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Base URL</p>
                <p class="mb-1">${escapeHtml(script.baseUrl || '')}</p>
                <p class="text-muted small mb-0">Default target unless PLAYWRIGHT_BASE_URL overrides it.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Authentication requirement</p>
                <p class="mb-1">${script.requiresLogin ? 'Required before protected routes are visited.' : 'No authenticated session is required for this scenario.'}</p>
                <p class="text-muted small mb-0">Whether the sign-in helper runs before route checks begin.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Purpose</p>
                <p class="mb-1">${escapeHtml(script.purpose)}</p>
                <p class="text-muted small mb-0">What this scenario is meant to validate.</p>
            </div>
            <div>
                <p class="fw-semibold mb-2">Route targets</p>
                <ul class="mb-0">
                    ${(script.routeTargets || []).map((routeTarget) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(routeTarget.path)}</span>
                            <div>${escapeHtml(routeTarget.description)}</div>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div>
                <p class="fw-semibold mb-2">Assertions</p>
                <ul class="mb-0">
                    ${(script.assertionDetails || []).map((assertion) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(assertion.label)}</span>
                            <div>${escapeHtml(assertion.description)}</div>
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div>
                <p class="fw-semibold mb-2">Usage notes</p>
                <ul class="mb-0">
                    ${(script.usageNotes || []).map((note) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(note.label)}</span>
                            <div>${escapeHtml(note.description)}</div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function renderLatestRunSummary(suite = {}) {
    const latestRun = suite && suite.latestRun ? suite.latestRun : null;

    if (suiteImplementedCountEl) {
        suiteImplementedCountEl.textContent = String(suite && suite.implementedScenarioCount ? suite.implementedScenarioCount : 0);
    }

    if (suiteFilesEl) {
        const suiteFiles = Array.isArray(suite && suite.suiteFiles) ? suite.suiteFiles : [];
        suiteFilesEl.textContent = suiteFiles.length
            ? `Suite files: ${suiteFiles.join(', ')}`
            : 'Suite files: no shared Playwright suite files are registered yet.';
    }

    if (!latestRunStatusEl || !latestRunGeneratedAtEl || !latestRunSummaryEl) {
        return;
    }

    if (!latestRun || !latestRun.available) {
        latestRunStatusEl.textContent = 'Unavailable';
        latestRunGeneratedAtEl.textContent = latestRun && latestRun.error
            ? `Latest reporter read failed: ${latestRun.error}`
            : 'No Playwright reporter output is available yet.';
        latestRunSummaryEl.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">Run `npm run test:e2e` or let CI publish a Playwright JSON report to populate this panel.</div></div>';
        return;
    }

    latestRunStatusEl.textContent = latestRun.status ? latestRun.status.toUpperCase() : 'UNKNOWN';
    latestRunGeneratedAtEl.textContent = `Generated ${formatDateTime(latestRun.generatedAt)} from ${latestRun.sourcePath || 'the Playwright JSON report'}.`;

    const projectRows = Array.isArray(latestRun.projects) ? latestRun.projects.map((project) => `
        <div class="col-md-4">
            <div class="playwright-prereq-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <p class="fw-semibold mb-0">${escapeHtml(project.name)}</p>
                    <span class="badge text-bg-${getRunTone(project.status)}">${escapeHtml(project.status)}</span>
                </div>
                <p class="text-muted small mb-0">${escapeHtml(`${project.passed} passed, ${project.failed} failed, ${project.flaky} flaky, ${project.skipped} skipped out of ${project.total}.`)}</p>
            </div>
        </div>
    `).join('') : '';

    latestRunSummaryEl.innerHTML = `
        <div class="col-md-4">
            <div class="playwright-prereq-card h-100">
                <p class="fw-semibold mb-1">Overall</p>
                <p class="mb-1">${escapeHtml(`${latestRun.total} test result(s)`)}</p>
                <p class="text-muted small mb-0">${escapeHtml(`${latestRun.passed} passed, ${latestRun.failed} failed, ${latestRun.flaky} flaky, ${latestRun.skipped} skipped in ${latestRun.durationMs} ms.`)}</p>
            </div>
        </div>
        ${projectRows}
    `;
}

function renderOverview(overview, helpers) {
    runtimeLabelEl.textContent = overview.module.runtime;
    scenarioCountEl.textContent = String(overview.coverage.scenarioCount || 0);
    authCountEl.textContent = String(overview.coverage.authenticatedScenarioCount || 0);
    baseUrlEl.textContent = overview.module.baseUrl;

    renderLatestRunSummary(overview.suite || {});
    renderControls(Array.isArray(overview.controls) ? overview.controls : []);
    renderWorkflow(Array.isArray(overview.workflow) ? overview.workflow : []);
    renderPrerequisites(Array.isArray(overview.prerequisites) ? overview.prerequisites : []);
    renderScenarioCards(Array.isArray(overview.scenarios) ? overview.scenarios : []);
    helpers.populateScenarioSelect(Array.isArray(overview.scenarios) ? overview.scenarios : [], overview.defaultScenarioId);
}

function renderScript(script) {
    scriptFileBadgeEl.textContent = script.fileName || 'Generated spec';
    scriptCodeEl.textContent = script.content || '// No spec content returned.';
    renderScenarioSummary(script);
}

const controller = createModuleController({
    rootId: 'playwright-module-root',
    datasetKeys: {
        overview: 'playwrightOverviewEndpoint',
        script: 'playwrightScriptEndpoint'
    },
    defaultEndpoints: {
        overview: '/api/playwright/overview',
        script: '/api/playwright/script'
    },
    statusTargetId: 'playwright-status',
    scenarioSelectId: 'playwright-scenario-select',
    refreshButtonId: 'playwright-refresh-btn',
    loadButtonId: 'playwright-load-script-btn',
    copyButtonId: 'playwright-copy-script-btn',
    fallbackScenarioId: 'research-full-suite',
    overviewErrorMessage: 'Unable to load the Playwright module overview.',
    scriptErrorMessage: 'Unable to load the Playwright spec template.',
    readyMessage: 'Playwright module ready. Select a scenario to preview a starter spec.',
    refreshSuccessMessage: 'Playwright module refreshed.',
    loadSuccessMessage: 'Loaded the selected spec.',
    changeSuccessMessage: 'Updated the spec preview for the selected scenario.',
    copyEmptyMessage: 'Load a spec before copying it.',
    copyUnsupportedMessage: 'Clipboard access is not available in this browser. Copy the preview manually instead.',
    buildCopySuccessMessage: (script) => `Copied ${script.fileName} to the clipboard.`,
    renderOverview,
    renderScript
});

controller.initialize();
