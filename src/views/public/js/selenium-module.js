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
const workflowGrid = document.getElementById('selenium-workflow-grid');
const prerequisitesGrid = document.getElementById('selenium-prerequisites-grid');
const scenariosGrid = document.getElementById('selenium-scenarios-grid');
const scenarioSelect = document.getElementById('selenium-scenario-select');
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
                    <span class="badge text-bg-${scenario.requiresLogin ? 'info' : 'secondary'}">${scenario.requiresLogin ? 'Auth required' : 'Public flow'}</span>
                </div>
                <p class="text-muted mb-3">${escapeHtml(scenario.purpose)}</p>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${scenario.tags.map((tag) => `<span class="selenium-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                <p class="fw-semibold mb-2">Route targets</p>
                <ul class="mb-3">
                    ${scenario.routePaths.map((routePath) => `<li class="text-muted small">${escapeHtml(routePath)}</li>`).join('')}
                </ul>
                <p class="fw-semibold mb-2">Assertions</p>
                <ul class="mb-0">
                    ${scenario.assertions.map((assertion) => `<li class="text-muted small">${escapeHtml(assertion)}</li>`).join('')}
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
        scriptSummaryEl.innerHTML = '<div class="alert alert-secondary mb-0">No Selenium scenario has been selected yet.</div>';
        return;
    }

    scriptSummaryEl.innerHTML = `
        <dl class="automation-metadata mb-0">
            <div><dt>Scenario</dt><dd>${escapeHtml(script.title)}</dd></div>
            <div><dt>File name</dt><dd>${escapeHtml(script.fileName)}</dd></div>
            <div><dt>Language</dt><dd>${escapeHtml(script.language)}</dd></div>
            <div><dt>Runtime</dt><dd>${escapeHtml(script.runtime)}</dd></div>
            <div class="automation-path-row"><dt>Purpose</dt><dd>${escapeHtml(script.purpose)}</dd></div>
        </dl>
    `;
}

function renderOverview(overview) {
    latestOverview = overview;
    runtimeLabelEl.textContent = overview.module.runtime;
    scenarioCountEl.textContent = String(overview.coverage.scenarioCount || 0);
    authCountEl.textContent = String(overview.coverage.authenticatedScenarioCount || 0);
    baseUrlEl.textContent = overview.module.baseUrl;

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
        renderStatus('Selenium module ready. Pick a scenario to preview a WebDriver smoke template for this app.', 'secondary');
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
