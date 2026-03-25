const rootEl = document.getElementById('playwright-module-root');
const overviewEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.playwrightOverviewEndpoint || '/api/playwright/overview'
    : '/api/playwright/overview';
const scriptEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.playwrightScriptEndpoint || '/api/playwright/script'
    : '/api/playwright/script';

const statusTarget = document.getElementById('playwright-status');
const runtimeLabelEl = document.getElementById('playwright-runtime-label');
const scenarioCountEl = document.getElementById('playwright-scenario-count');
const authCountEl = document.getElementById('playwright-auth-count');
const baseUrlEl = document.getElementById('playwright-base-url');
const controlsGuideEl = document.getElementById('playwright-controls-guide');
const workflowGrid = document.getElementById('playwright-workflow-grid');
const prerequisitesGrid = document.getElementById('playwright-prerequisites-grid');
const scenariosGrid = document.getElementById('playwright-scenarios-grid');
const scenarioSelect = document.getElementById('playwright-scenario-select');
const scriptSummaryEl = document.getElementById('playwright-script-summary');
const scriptFileBadgeEl = document.getElementById('playwright-script-file-badge');
const scriptCodeEl = document.getElementById('playwright-script-code');
const refreshBtn = document.getElementById('playwright-refresh-btn');
const loadScriptBtn = document.getElementById('playwright-load-script-btn');
const copyScriptBtn = document.getElementById('playwright-copy-script-btn');

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
                    <span class="badge text-bg-${scenario.requiresLogin ? 'info' : 'secondary'}">${scenario.requiresLogin ? 'Auth required' : 'Public flow'}</span>
                </div>
                <p class="text-muted mb-3">${escapeHtml(scenario.purpose)}</p>
                <p class="small mb-3">${escapeHtml(scenario.functionDescription || '')}</p>
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

function renderOverview(overview) {
    latestOverview = overview;
    runtimeLabelEl.textContent = overview.module.runtime;
    scenarioCountEl.textContent = String(overview.coverage.scenarioCount || 0);
    authCountEl.textContent = String(overview.coverage.authenticatedScenarioCount || 0);
    baseUrlEl.textContent = overview.module.baseUrl;

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
    const script = await requestJson(url, 'Unable to load the Playwright spec template.');

    latestScript = script;
    scriptFileBadgeEl.textContent = script.fileName || 'Generated spec';
    scriptCodeEl.textContent = script.content || '// No spec content returned.';
    renderScenarioSummary(script);
    return script;
}

async function refreshModule(showMessage = false) {
    const overview = await requestJson(overviewEndpoint, 'Unable to load the Playwright module overview.');
    renderOverview(overview);
    await loadScript();
    if (showMessage) {
        renderStatus('Playwright module refreshed.', 'secondary');
    }
}

async function copyCurrentScript() {
    if (!latestScript || !latestScript.content) {
        renderStatus('Load a spec before copying it.', 'warning');
        return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        renderStatus('Clipboard access is not available in this browser. Copy the preview manually instead.', 'warning');
        return;
    }

    await navigator.clipboard.writeText(latestScript.content);
    renderStatus(`Copied ${latestScript.fileName} to the clipboard.`, 'success');
}

async function initializePlaywrightModule() {
    try {
        await refreshModule(false);
        renderStatus('Playwright module ready. Select a scenario to preview a starter spec.', 'secondary');
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Playwright module.', 'danger');
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        refreshModule(true).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the Playwright module.', 'danger');
        });
    });
}

if (loadScriptBtn) {
    loadScriptBtn.addEventListener('click', () => {
        loadScript().then(() => {
            renderStatus('Loaded the selected spec.', 'success');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to load the selected Playwright spec.', 'danger');
        });
    });
}

if (copyScriptBtn) {
    copyScriptBtn.addEventListener('click', () => {
        copyCurrentScript().catch((error) => {
            renderStatus(error.message || 'Unable to copy the current Playwright spec.', 'danger');
        });
    });
}

if (scenarioSelect) {
    scenarioSelect.addEventListener('change', () => {
        loadScript().then(() => {
            renderStatus('Updated the spec preview for the selected scenario.', 'secondary');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the selected Playwright scenario.', 'danger');
        });
    });
}

initializePlaywrightModule();
