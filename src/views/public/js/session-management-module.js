const rootEl = document.getElementById('session-management-module-root');
const overviewEndpoint = rootEl?.dataset?.sessionManagementOverviewEndpoint || '/api/session-management/overview';
const evaluateEndpoint = rootEl?.dataset?.sessionManagementEvaluateEndpoint || '/api/session-management/evaluate';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const statusEl = document.getElementById('session-management-status');
const statusCopyEl = document.getElementById('session-management-status-copy');
const stateBadgeEl = document.getElementById('session-management-state-badge');
const idleTimeoutEl = document.getElementById('session-management-idle-timeout');
const absoluteTimeoutEl = document.getElementById('session-management-absolute-timeout');
const concurrentBadgeEl = document.getElementById('session-management-concurrent-badge');
const summaryEl = document.getElementById('session-management-summary');
const controlsEl = document.getElementById('session-management-controls');
const scenarioSelectEl = document.getElementById('session-management-scenario-select');
const networkZoneEl = document.getElementById('session-management-network-zone');
const idleMinutesEl = document.getElementById('session-management-idle-minutes');
const elapsedHoursEl = document.getElementById('session-management-elapsed-hours');
const concurrentToggleEl = document.getElementById('session-management-concurrent-toggle');
const evaluationEl = document.getElementById('session-management-evaluation');
const refreshBtn = document.getElementById('session-management-refresh-btn');
const evaluateBtn = document.getElementById('session-management-evaluate-btn');
let currentScenarios = [];

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function prettyLabel(value = '') {
    return String(value || '')
        .split(/[_-]+/)
        .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
        .join(' ');
}

function formatTimestamp(value = '') {
    if (!value) {
        return 'Not available';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString();
}

function renderStatus(message, tone = 'secondary') {
    if (statusEl) {
        statusEl.innerHTML = `<div class="alert alert-${escapeHtml(tone)} mb-0">${escapeHtml(message)}</div>`;
    }
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

function renderOverview(overview) {
    const currentSession = overview.currentSession || {};
    const policy = overview.policy || {};
    currentScenarios = Array.isArray(overview.scenarios) ? overview.scenarios : [];

    if (stateBadgeEl) {
        stateBadgeEl.textContent = currentSession.valid ? 'Active' : (currentSession.tracked ? 'Locked' : 'Untracked');
    }

    if (idleTimeoutEl) {
        idleTimeoutEl.textContent = `${policy.idleTimeoutMinutes || 0}m`;
    }

    if (absoluteTimeoutEl) {
        absoluteTimeoutEl.textContent = `${policy.absoluteTimeoutHours || 0}h`;
    }

    if (concurrentBadgeEl) {
        concurrentBadgeEl.textContent = policy.preventConcurrentLogins ? 'Enforced' : 'Disabled';
    }

    if (statusCopyEl) {
        statusCopyEl.textContent = currentSession.lockReasonDescription || 'The current session is being evaluated server-side.';
    }

    if (summaryEl) {
        summaryEl.innerHTML = `
            <dl class="row mb-0">
                <dt class="col-sm-5">Network zone</dt>
                <dd class="col-sm-7">${escapeHtml(prettyLabel(currentSession.networkZone || policy.networkZone || 'corp'))}</dd>
                <dt class="col-sm-5">Session ID</dt>
                <dd class="col-sm-7">${escapeHtml(currentSession.sessionId || 'Not tracked')}</dd>
                <dt class="col-sm-5">Issued at</dt>
                <dd class="col-sm-7">${escapeHtml(formatTimestamp(currentSession.issuedAt))}</dd>
                <dt class="col-sm-5">Last activity</dt>
                <dd class="col-sm-7">${escapeHtml(formatTimestamp(currentSession.lastActivityAt))}</dd>
                <dt class="col-sm-5">Idle expiry</dt>
                <dd class="col-sm-7">${escapeHtml(formatTimestamp(currentSession.idleExpiresAt))}</dd>
                <dt class="col-sm-5">Absolute expiry</dt>
                <dd class="col-sm-7">${escapeHtml(formatTimestamp(currentSession.absoluteExpiresAt))}</dd>
                <dt class="col-sm-5">Concurrent login</dt>
                <dd class="col-sm-7">${currentSession.preventConcurrentLogins ? 'Prevented' : 'Allowed'}</dd>
            </dl>
        `;
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

    if (scenarioSelectEl) {
        scenarioSelectEl.innerHTML = currentScenarios.map((scenario) => `
            <option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.label)}</option>
        `).join('');

        if (overview.defaultScenarioId) {
            scenarioSelectEl.value = overview.defaultScenarioId;
        }
    }

    if (overview.defaultEvaluation) {
        applyScenarioToForm(overview.defaultEvaluation);
        renderEvaluation(overview.defaultEvaluation);
    }
}

function applyScenarioToForm(evaluation) {
    if (!evaluation || !evaluation.scenario) {
        return;
    }

    if (networkZoneEl && evaluation.policy && evaluation.policy.networkZone) {
        networkZoneEl.value = evaluation.policy.networkZone;
    }

    if (idleMinutesEl && evaluation.observed) {
        idleMinutesEl.value = String(evaluation.observed.idleMinutes ?? 0);
    }

    if (elapsedHoursEl && evaluation.observed) {
        elapsedHoursEl.value = String(evaluation.observed.elapsedHours ?? 0);
    }

    if (concurrentToggleEl && evaluation.observed) {
        concurrentToggleEl.checked = Boolean(evaluation.observed.concurrentLoginDetected);
    }
}

function renderEvaluation(evaluation) {
    if (!evaluationEl) {
        return;
    }

    evaluationEl.innerHTML = `
        <div class="playwright-scenario-card">
            <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(evaluation.locked ? 'lockdown' : 'allow')}</p>
                    <h3 class="h5 mb-1">${escapeHtml(evaluation.scenario?.label || 'Session decision')}</h3>
                </div>
                <span class="badge text-bg-${evaluation.locked ? 'danger' : 'success'}">${escapeHtml(prettyLabel(evaluation.decision))}</span>
            </div>
            <p class="text-muted mb-3">${escapeHtml(evaluation.reasonSummary || '')}</p>
            <dl class="row mb-0">
                <dt class="col-sm-6">Zone</dt>
                <dd class="col-sm-6">${escapeHtml(prettyLabel(evaluation.policy?.networkZone || 'corp'))}</dd>
                <dt class="col-sm-6">Idle threshold</dt>
                <dd class="col-sm-6">${escapeHtml(String(evaluation.policy?.idleTimeoutMinutes || 0))} minutes</dd>
                <dt class="col-sm-6">Absolute threshold</dt>
                <dd class="col-sm-6">${escapeHtml(String(evaluation.policy?.absoluteTimeoutHours || 0))} hours</dd>
                <dt class="col-sm-6">Observed idle</dt>
                <dd class="col-sm-6">${escapeHtml(String(evaluation.observed?.idleMinutes || 0))} minutes</dd>
                <dt class="col-sm-6">Observed lifetime</dt>
                <dd class="col-sm-6">${escapeHtml(String(evaluation.observed?.elapsedHours || 0))} hours</dd>
                <dt class="col-sm-6">Second login</dt>
                <dd class="col-sm-6">${evaluation.observed?.concurrentLoginDetected ? 'Yes' : 'No'}</dd>
            </dl>
        </div>
    `;
}

async function loadOverview() {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);
    renderStatus('Session Management Module ready.', 'secondary');
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
            networkZone: networkZoneEl?.value || 'corp',
            idleMinutes: Number(idleMinutesEl?.value || 0),
            elapsedHours: Number(elapsedHoursEl?.value || 0),
            concurrentLoginDetected: Boolean(concurrentToggleEl?.checked)
        })
    });

    renderEvaluation(evaluation);
    renderStatus('Evaluated the selected session-management scenario.', evaluation.locked ? 'warning' : 'success');
}

if (rootEl) {
    refreshBtn?.addEventListener('click', () => {
        loadOverview().catch((error) => {
            renderStatus(error.message || 'Unable to refresh the session-management module.', 'danger');
        });
    });

    scenarioSelectEl?.addEventListener('change', () => {
        const scenario = currentScenarios.find((entry) => entry.id === scenarioSelectEl.value);
        if (!scenario) {
            return;
        }

        if (networkZoneEl) {
            networkZoneEl.value = scenario.networkZone;
        }

        if (idleMinutesEl) {
            idleMinutesEl.value = String(scenario.idleMinutes);
        }

        if (elapsedHoursEl) {
            elapsedHoursEl.value = String(scenario.elapsedHours);
        }

        if (concurrentToggleEl) {
            concurrentToggleEl.checked = Boolean(scenario.concurrentLoginDetected);
        }
    });

    evaluateBtn?.addEventListener('click', () => {
        evaluateScenario().catch((error) => {
            renderStatus(error.message || 'Unable to evaluate the session-management scenario.', 'danger');
        });
    });

    loadOverview().catch((error) => {
        renderStatus(error.message || 'Unable to load the Session Management Module.', 'danger');
    });
}
