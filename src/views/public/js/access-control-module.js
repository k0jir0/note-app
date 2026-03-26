const rootEl = document.getElementById('access-control-module-root');
const overviewEndpoint = rootEl?.dataset?.accessControlOverviewEndpoint || '/api/access-control/overview';
const evaluateEndpoint = rootEl?.dataset?.accessControlEvaluateEndpoint || '/api/access-control/evaluate';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const routeCountEl = document.getElementById('access-control-route-count');
const routeAuthCountEl = document.getElementById('access-control-route-auth-count');
const missionCountEl = document.getElementById('access-control-mission-count');
const publicCountEl = document.getElementById('access-control-public-count');
const statusEl = document.getElementById('access-control-status');
const statusCopyEl = document.getElementById('access-control-status-copy');
const controlsEl = document.getElementById('access-control-controls');
const currentIdentityEl = document.getElementById('access-control-current-identity');
const routeCatalogEl = document.getElementById('access-control-route-catalog');
const scenarioSelectEl = document.getElementById('access-control-scenario-select');
const authenticatedEl = document.getElementById('access-control-authenticated');
const serverIdentityEl = document.getElementById('access-control-server-identity');
const ownedResourceEl = document.getElementById('access-control-owned-resource');
const frontendVisibleEl = document.getElementById('access-control-frontend-visible');
const missionRoleEl = document.getElementById('access-control-mission-role');
const evaluationEl = document.getElementById('access-control-evaluation');
const refreshBtn = document.getElementById('access-control-refresh-btn');
const evaluateBtn = document.getElementById('access-control-evaluate-btn');

let currentScenarios = [];

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function renderStatus(message, tone = 'secondary') {
    if (!statusEl) {
        return;
    }

    statusEl.innerHTML = `<div class="alert alert-${escapeHtml(tone)} mb-0">${escapeHtml(message)}</div>`;
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(options.headers || {})
        },
        method: options.method || 'GET',
        body: options.body
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        const firstError = payload.errors && payload.errors.length ? payload.errors[0] : payload.message;
        throw new Error(firstError || 'The request could not be completed.');
    }

    return payload.data;
}

function renderEvaluation(evaluation = {}) {
    if (!evaluationEl) {
        return;
    }

    const failedChecks = Array.isArray(evaluation.failedChecks) ? evaluation.failedChecks : [];
    evaluationEl.innerHTML = `
        <div class="playwright-scenario-card">
            <div class="d-flex justify-content-between gap-3 mb-3 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(evaluation.decision || 'allow')}</p>
                    <h3 class="h5 mb-1">${escapeHtml(evaluation.scenario?.label || 'Access decision')}</h3>
                </div>
                <span class="badge text-bg-${evaluation.allowed ? 'success' : 'danger'}">${escapeHtml(String(evaluation.httpStatus || 200))}</span>
            </div>
            <p class="text-muted mb-3">${escapeHtml(evaluation.summary || '')}</p>
            <dl class="automation-metadata mb-3">
                <div><dt>Route</dt><dd>${escapeHtml(evaluation.route?.method || 'GET')} ${escapeHtml(evaluation.route?.path || '')}</dd></div>
                <div><dt>Verification</dt><dd>${escapeHtml(evaluation.route?.serverVerification || 'global gate')}</dd></div>
                <div><dt>Frontend independent</dt><dd>${escapeHtml(evaluation.frontendIndependent ? 'yes' : 'no')}</dd></div>
                <div><dt>Mission policy</dt><dd>${escapeHtml(evaluation.route?.missionPolicyEnabled ? 'enabled' : 'not required')}</dd></div>
            </dl>
            <p class="fw-semibold mb-2">Failed checks</p>
            ${failedChecks.length
        ? `<ul class="mb-3">${failedChecks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul>`
        : '<p class="text-muted mb-3">No server-side check failed in this scenario.</p>'}
            <p class="mb-0 text-muted">${escapeHtml(evaluation.explanation || '')}</p>
        </div>
    `;
}

function renderScenarioDefaults() {
    if (!scenarioSelectEl) {
        return;
    }

    const selectedScenario = currentScenarios.find((scenario) => scenario.id === scenarioSelectEl.value);
    if (!selectedScenario) {
        return;
    }

    authenticatedEl.value = String(Boolean(selectedScenario.defaults?.authenticated));
    serverIdentityEl.value = String(Boolean(selectedScenario.defaults?.serverIdentityVerified));
    ownedResourceEl.value = String(Boolean(selectedScenario.defaults?.ownsResource));
    frontendVisibleEl.value = String(Boolean(selectedScenario.defaults?.frontendVisible));
    missionRoleEl.value = selectedScenario.defaults?.missionRole || 'analyst';
    renderStatus('Loaded the selected access-control scenario.', 'secondary');
}

function renderOverview(overview = {}) {
    if (routeCountEl) {
        routeCountEl.textContent = String(overview.coverage?.protectedRouteCount || 0);
    }

    if (routeAuthCountEl) {
        routeAuthCountEl.textContent = String(overview.coverage?.routeLevelAuthCount || 0);
    }

    if (missionCountEl) {
        missionCountEl.textContent = String(overview.coverage?.missionScopedRouteCount || 0);
    }

    if (publicCountEl) {
        publicCountEl.textContent = String(overview.coverage?.publicExceptionCount || 0);
    }

    if (statusCopyEl) {
        statusCopyEl.textContent = `Protected by default prefixes: ${(overview.guard?.protectedPrefixes || []).join(', ')}. Explicit public exceptions: ${(overview.guard?.publicExceptions || []).join(', ') || 'none'}.`;
    }

    if (controlsEl) {
        controlsEl.innerHTML = (overview.controls || []).map((control) => `
            <div class="col-md-6">
                <div class="playwright-prereq-card h-100">
                    <p class="fw-semibold mb-2">${escapeHtml(control.label)}</p>
                    <p class="text-muted mb-0">${escapeHtml(control.description)}</p>
                </div>
            </div>
        `).join('');
    }

    if (currentIdentityEl) {
        currentIdentityEl.innerHTML = `
            <dl class="automation-metadata mb-0">
                <div><dt>Authenticated</dt><dd>${escapeHtml(overview.identity?.authenticated ? 'yes' : 'no')}</dd></div>
                <div><dt>User</dt><dd>${escapeHtml(overview.identity?.displayName || 'Anonymous request')}</dd></div>
                <div><dt>Role</dt><dd>${escapeHtml(overview.identity?.missionRole || 'none')}</dd></div>
                <div><dt>Clearance</dt><dd>${escapeHtml(overview.identity?.clearance || 'none')}</dd></div>
            </dl>
        `;
    }

    if (routeCatalogEl) {
        routeCatalogEl.innerHTML = (overview.routeCatalog || []).map((route) => `
            <div class="col-md-6 col-xl-4">
                <div class="playwright-scenario-card h-100">
                    <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                        <span class="selenium-tag">${escapeHtml(route.method)}</span>
                        <span class="badge text-bg-${route.missionPolicyEnabled ? 'dark' : 'secondary'}">${escapeHtml(route.serverVerification)}</span>
                    </div>
                    <p class="fw-semibold mb-2">${escapeHtml(route.path)}</p>
                    <p class="text-muted small mb-2">${escapeHtml(route.source)}</p>
                    <div class="d-flex flex-wrap gap-2 small text-muted">
                        <span>Route auth: ${escapeHtml(route.hasRouteLevelAuth ? 'yes' : 'no')}</span>
                        <span>Mission policy: ${escapeHtml(route.missionPolicyEnabled ? 'yes' : 'no')}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    currentScenarios = Array.isArray(overview.scenarios) ? overview.scenarios : [];
    if (scenarioSelectEl) {
        scenarioSelectEl.innerHTML = currentScenarios.map((scenario) => `
            <option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.label)}</option>
        `).join('');
        scenarioSelectEl.value = overview.defaultScenarioId || currentScenarios[0]?.id || '';
    }

    renderScenarioDefaults();
    renderEvaluation(overview.defaultEvaluation || {});
}

async function loadOverview(showMessage = false) {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);

    if (showMessage) {
        renderStatus('Access Control Module refreshed.', 'secondary');
    } else {
        renderStatus('Access Control Module ready.', 'secondary');
    }
}

async function evaluateScenario() {
    const evaluation = await requestJson(evaluateEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            scenarioId: scenarioSelectEl?.value || '',
            authenticated: authenticatedEl?.value === 'true',
            serverIdentityVerified: serverIdentityEl?.value === 'true',
            ownsResource: ownedResourceEl?.value === 'true',
            frontendVisible: frontendVisibleEl?.value === 'true',
            missionRole: missionRoleEl?.value || 'analyst'
        })
    });

    renderEvaluation(evaluation);
    renderStatus(`Access decision complete: ${evaluation.decision || 'allow'}.`, evaluation.allowed ? 'success' : 'danger');
}

async function initializeAccessControlModule() {
    if (!rootEl) {
        return;
    }

    try {
        await loadOverview(false);
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Access Control Module.', 'danger');
        return;
    }

    refreshBtn?.addEventListener('click', async () => {
        try {
            await loadOverview(true);
        } catch (error) {
            renderStatus(error.message || 'Unable to refresh the Access Control Module.', 'danger');
        }
    });

    scenarioSelectEl?.addEventListener('change', () => {
        renderScenarioDefaults();
    });

    evaluateBtn?.addEventListener('click', async () => {
        try {
            await evaluateScenario();
        } catch (error) {
            renderStatus(error.message || 'Unable to evaluate the access-control scenario.', 'danger');
        }
    });
}

void initializeAccessControlModule();
