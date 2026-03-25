const rootEl = document.getElementById('selenium-module-root');
const overviewEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.seleniumOverviewEndpoint || '/api/selenium/overview'
    : '/api/selenium/overview';
const scriptEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.seleniumScriptEndpoint || '/api/selenium/script'
    : '/api/selenium/script';

const statusTarget = document.getElementById('selenium-status');
const runtimeLabelEl = document.getElementById('selenium-runtime-label');
const scenarioCountEl = document.getElementById('selenium-scenario-count');
const authCountEl = document.getElementById('selenium-auth-count');
const baseUrlEl = document.getElementById('selenium-base-url');
const controlsGuideEl = document.getElementById('selenium-controls-guide');
const workflowGrid = document.getElementById('selenium-workflow-grid');
const prerequisitesGrid = document.getElementById('selenium-prerequisites-grid');
const scenariosGrid = document.getElementById('selenium-scenarios-grid');
const scenarioSelect = document.getElementById('selenium-scenario-select');
const suiteImplementedCountEl = document.getElementById('selenium-suite-implemented-count');
const latestRunStatusEl = document.getElementById('selenium-latest-run-status');
const latestRunGeneratedAtEl = document.getElementById('selenium-latest-run-generated-at');
const latestRunSummaryEl = document.getElementById('selenium-latest-run-summary');
const suiteFilesEl = document.getElementById('selenium-suite-files');
const scriptSummaryEl = document.getElementById('selenium-script-summary');
const scriptFileBadgeEl = document.getElementById('selenium-script-file-badge');
const scriptCodeEl = document.getElementById('selenium-script-code');
const refreshBtn = document.getElementById('selenium-refresh-btn');
const loadScriptBtn = document.getElementById('selenium-load-script-btn');
const copyScriptBtn = document.getElementById('selenium-copy-script-btn');

let latestOverview = null;
let latestScript = null;

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function renderStatus(message, tone = 'secondary') {
    if (!statusTarget) {
        return;
    }

    statusTarget.innerHTML = `<div class="alert alert-${escapeHtml(tone)} mb-0">${escapeHtml(message)}</div>`;
}

function formatDateTime(value) {
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleString();
}

function getRunTone(status) {
    switch (status) {
        case 'passed':
            return 'success';
        case 'failed':
            return 'danger';
        case 'skipped':
            return 'secondary';
        default:
            return 'light';
    }
}

function formatRunContext(scenario) {
    if (!scenario || scenario.latestRunStatus === 'unknown') {
        return 'No scenario-level run data is available yet.';
    }

    const durationText = scenario.latestRunDurationMs
        ? `${scenario.latestRunDurationMs} ms`
        : 'duration unavailable';
    const browserText = scenario.latestRunBrowserName
        ? `${scenario.latestRunBrowserName}${scenario.latestRunHeadless ? ' headless' : ''}`
        : 'browser unavailable';

    return `${durationText} via ${scenario.latestRunFile || 'unknown suite file'} on ${browserText}.`;
}

async function requestJson(url, fallbackMessage) {
    try {
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json'
            }
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(fallbackMessage || 'The server returned an unexpected response.');
        }

        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || fallbackMessage || 'The request could not be completed.');
        }

        return payload.data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Could not reach the server. Refresh the page and confirm the app is still running on localhost:3000.');
        }

        throw error;
    }
}

function renderWorkflow(items = []) {
    if (!workflowGrid) {
        return;
    }

    if (!items.length) {
        workflowGrid.innerHTML = '<div class="alert alert-secondary mb-0">No Selenium workflow steps are available right now.</div>';
        return;
    }

    workflowGrid.innerHTML = items.map((item) => `
        <div class="selenium-workflow-step">
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
            <div class="selenium-prereq-card h-100">
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
        prerequisitesGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No browser prerequisites are available right now.</div></div>';
        return;
    }

    prerequisitesGrid.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="selenium-prereq-card h-100">
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
        scenariosGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No Selenium scenarios are available right now.</div></div>';
        return;
    }

    scenariosGrid.innerHTML = items.map((scenario) => `
        <div class="col-xl-6">
            <div class="selenium-scenario-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <div>
                        <p class="research-kicker mb-1">${escapeHtml(scenario.id)}</p>
                        <h3 class="h5 mb-1">${escapeHtml(scenario.title)}</h3>
                    </div>
                    <div class="d-flex gap-2 flex-wrap justify-content-end">
                        <span class="badge text-bg-${scenario.requiresLogin ? 'info' : 'secondary'}">${scenario.requiresLogin ? 'Protected flow' : 'Self-contained flow'}</span>
                        <span class="badge text-bg-${getRunTone(scenario.latestRunStatus)}">${escapeHtml(scenario.latestRunStatus === 'unknown' ? 'Run status unavailable' : `Latest run: ${scenario.latestRunStatus}`)}</span>
                    </div>
                </div>
                <p class="text-muted mb-3">${escapeHtml(scenario.purpose)}</p>
                <p class="small mb-3">${escapeHtml(scenario.functionDescription || '')}</p>
                <p class="text-muted small mb-3">${escapeHtml(formatRunContext(scenario))}</p>
                <p class="fw-semibold mb-2">Tags</p>
                <div class="mb-3">
                    ${scenario.tagDetails.map((tag) => `
                        <div class="mb-2">
                            <span class="selenium-tag">${escapeHtml(tag.label)}</span>
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
        : ['No optional setup is required beyond the standard Selenium runtime.']).map((dependency) => `
                        <li class="text-muted small">${escapeHtml(dependency)}</li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

function populateScenarioSelect(items = [], defaultScenarioId = '') {
    if (!scenarioSelect) {
        return;
    }

    scenarioSelect.innerHTML = items.map((scenario) => `
        <option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.title)}</option>
    `).join('');

    if (defaultScenarioId) {
        scenarioSelect.value = defaultScenarioId;
    }
}

function renderScenarioSummary(script) {
    if (!scriptSummaryEl) {
        return;
    }

    if (!script) {
        scriptSummaryEl.innerHTML = '<div class="alert alert-secondary mb-0">Select a Selenium scenario to see its summary.</div>';
        return;
    }

    const latestRunLabel = script.latestRunStatus && script.latestRunStatus !== 'unknown'
        ? `${script.latestRunStatus} in ${script.latestRunDurationMs || 0} ms`
        : 'No recorded Selenium run for this scenario yet.';

    scriptSummaryEl.innerHTML = `
        <div class="mb-3">
            <p class="text-muted mb-0">${escapeHtml(script.functionDescription || script.purpose || '')}</p>
        </div>
        <div class="d-flex flex-column gap-3">
            <div>
                <p class="fw-semibold mb-1">Scenario</p>
                <p class="mb-1">${escapeHtml(script.title)}</p>
                <p class="text-muted small mb-0">The Selenium browser path represented by this exported script.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Latest run</p>
                <p class="mb-1">${escapeHtml(latestRunLabel)}</p>
                <p class="text-muted small mb-0">${escapeHtml(script.latestRunFile ? `Reported by ${script.latestRunFile}${script.latestRunBrowserName ? ` on ${script.latestRunBrowserName}${script.latestRunHeadless ? ' headless' : ''}` : ''}.` : 'Run `npm run test:selenium` to populate this scenario with a real browser result.')}</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">File name</p>
                <p class="mb-1">${escapeHtml(script.fileName)}</p>
                <p class="text-muted small mb-0">Suggested file name for a standalone Selenium project.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Language and runtime</p>
                <p class="mb-1">${escapeHtml(script.language)} / ${escapeHtml(script.runtime)}</p>
                <p class="text-muted small mb-0">Format used by the exported WebDriver template.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Base URL</p>
                <p class="mb-1">${escapeHtml(script.baseUrl || '')}</p>
                <p class="text-muted small mb-0">Default target unless SELENIUM_BASE_URL overrides it.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Authentication model</p>
                <p class="mb-1">${script.requiresLogin ? 'This scenario reaches protected routes after creating or reusing an authenticated browser session.' : 'This scenario can be exercised without starting from a protected route.'}</p>
                <p class="text-muted small mb-0">The exported script can create a disposable account automatically when SELENIUM_TEST_EMAIL is not provided.</p>
            </div>
            <div>
                <p class="fw-semibold mb-1">Purpose</p>
                <p class="mb-1">${escapeHtml(script.purpose)}</p>
                <p class="text-muted small mb-0">What this Selenium scenario is meant to validate.</p>
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
            : 'Suite files: no shared Selenium suite files are registered yet.';
    }

    if (!latestRunStatusEl || !latestRunGeneratedAtEl || !latestRunSummaryEl) {
        return;
    }

    if (!latestRun || !latestRun.available) {
        latestRunStatusEl.textContent = 'Unavailable';
        latestRunGeneratedAtEl.textContent = latestRun && latestRun.error
            ? `Latest reporter read failed: ${latestRun.error}`
            : 'No Selenium reporter output is available yet.';
        latestRunSummaryEl.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">Run `npm run test:selenium` to populate this panel with the latest Selenium browser results.</div></div>';
        return;
    }

    latestRunStatusEl.textContent = latestRun.status ? latestRun.status.toUpperCase() : 'UNKNOWN';
    latestRunGeneratedAtEl.textContent = `Generated ${formatDateTime(latestRun.generatedAt)} from ${latestRun.sourcePath || 'the Selenium results artifact'}.`;

    const fileRows = Array.isArray(latestRun.files) ? latestRun.files.map((fileSummary) => `
        <div class="col-md-4">
            <div class="selenium-prereq-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <p class="fw-semibold mb-0">${escapeHtml(fileSummary.file)}</p>
                    <span class="badge text-bg-${getRunTone(fileSummary.status)}">${escapeHtml(fileSummary.status)}</span>
                </div>
                <p class="text-muted small mb-0">${escapeHtml(`${fileSummary.passed} passed, ${fileSummary.failed} failed, ${fileSummary.skipped} skipped out of ${fileSummary.total}.`)}</p>
            </div>
        </div>
    `).join('') : '';

    latestRunSummaryEl.innerHTML = `
        <div class="col-md-4">
            <div class="selenium-prereq-card h-100">
                <p class="fw-semibold mb-1">Overall</p>
                <p class="mb-1">${escapeHtml(`${latestRun.total} test result(s)`)}</p>
                <p class="text-muted small mb-0">${escapeHtml(`${latestRun.passed} passed, ${latestRun.failed} failed, ${latestRun.skipped} skipped in ${latestRun.durationMs} ms.`)}</p>
            </div>
        </div>
        <div class="col-md-4">
            <div class="selenium-prereq-card h-100">
                <p class="fw-semibold mb-1">Environment</p>
                <p class="mb-1">${escapeHtml(`${latestRun.browserName || 'unknown'}${latestRun.headless ? ' headless' : ' headed'}`)}</p>
                <p class="text-muted small mb-0">${escapeHtml(`Base URL: ${latestRun.baseUrl || ''}`)}</p>
            </div>
        </div>
        ${fileRows}
    `;
}

function renderOverview(overview) {
    latestOverview = overview;
    runtimeLabelEl.textContent = overview.module.runtime;
    scenarioCountEl.textContent = String(overview.coverage.scenarioCount || 0);
    authCountEl.textContent = String(overview.coverage.authenticatedScenarioCount || 0);
    baseUrlEl.textContent = overview.module.baseUrl;

    renderLatestRunSummary(overview.suite || {});
    renderControls(Array.isArray(overview.controls) ? overview.controls : []);
    renderWorkflow(Array.isArray(overview.workflow) ? overview.workflow : []);
    renderPrerequisites(Array.isArray(overview.prerequisites) ? overview.prerequisites : []);
    renderScenarioCards(Array.isArray(overview.scenarios) ? overview.scenarios : []);
    populateScenarioSelect(Array.isArray(overview.scenarios) ? overview.scenarios : [], overview.defaultScenarioId);
}

async function loadScript() {
    const scenarioId = scenarioSelect && scenarioSelect.value
        ? scenarioSelect.value
        : (latestOverview && latestOverview.defaultScenarioId ? latestOverview.defaultScenarioId : 'research-full-suite');

    const url = `${scriptEndpoint}?scenarioId=${encodeURIComponent(scenarioId)}`;
    const script = await requestJson(url, 'Unable to load the Selenium script template.');

    latestScript = script;
    scriptFileBadgeEl.textContent = script.fileName || 'Generated script';
    scriptCodeEl.textContent = script.content || '// No script content returned.';
    renderScenarioSummary(script);
    return script;
}

async function refreshModule(showMessage = false) {
    const overview = await requestJson(overviewEndpoint, 'Unable to load the Selenium module overview.');
    renderOverview(overview);
    await loadScript();
    if (showMessage) {
        renderStatus('Selenium module refreshed.', 'secondary');
    }
}

async function copyCurrentScript() {
    if (!latestScript || !latestScript.content) {
        renderStatus('Load a Selenium script first before copying it.', 'warning');
        return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        renderStatus('Clipboard access is not available in this browser. Copy the preview manually instead.', 'warning');
        return;
    }

    await navigator.clipboard.writeText(latestScript.content);
    renderStatus(`Copied ${latestScript.fileName} to the clipboard.`, 'success');
}

async function initializeSeleniumModule() {
    try {
        await refreshModule(false);
        renderStatus('Selenium module ready. Select a scenario to review the latest run and preview a starter WebDriver script.', 'secondary');
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Selenium module.', 'danger');
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        refreshModule(true).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the Selenium module.', 'danger');
        });
    });
}

if (loadScriptBtn) {
    loadScriptBtn.addEventListener('click', () => {
        loadScript().then(() => {
            renderStatus('Loaded the selected Selenium script template.', 'success');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to load the selected Selenium script.', 'danger');
        });
    });
}

if (copyScriptBtn) {
    copyScriptBtn.addEventListener('click', () => {
        copyCurrentScript().catch((error) => {
            renderStatus(error.message || 'Unable to copy the current Selenium script.', 'danger');
        });
    });
}

if (scenarioSelect) {
    scenarioSelect.addEventListener('change', () => {
        loadScript().then(() => {
            renderStatus('Updated the Selenium script preview for the selected scenario.', 'secondary');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the selected Selenium scenario.', 'danger');
        });
    });
}

initializeSeleniumModule();
