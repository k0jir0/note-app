const rootEl = document.getElementById('mission-assurance-module-root');
const overviewEndpoint = rootEl?.dataset?.missionAssuranceOverviewEndpoint || '/api/mission-assurance/overview';
const evaluateEndpoint = rootEl?.dataset?.missionAssuranceEvaluateEndpoint || '/api/mission-assurance/evaluate';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const statusEl = document.getElementById('mission-assurance-status');
const roleEl = document.getElementById('mission-assurance-role');
const clearanceEl = document.getElementById('mission-assurance-clearance');
const missionsEl = document.getElementById('mission-assurance-missions');
const sensitiveCountEl = document.getElementById('mission-assurance-sensitive-count');
const profileEl = document.getElementById('mission-assurance-profile');
const principlesEl = document.getElementById('mission-assurance-principles');
const controlsEl = document.getElementById('mission-assurance-controls');
const matrixEl = document.getElementById('mission-assurance-matrix');
const personaSelect = document.getElementById('mission-assurance-persona-select');
const actionSelect = document.getElementById('mission-assurance-action-select');
const resourceSelect = document.getElementById('mission-assurance-resource-select');
const networkSelect = document.getElementById('mission-assurance-network-select');
const justificationInput = document.getElementById('mission-assurance-justification');
const decisionBadgeEl = document.getElementById('mission-assurance-decision-badge');
const decisionSummaryEl = document.getElementById('mission-assurance-decision-summary');
const checksEl = document.getElementById('mission-assurance-checks');
const obligationsEl = document.getElementById('mission-assurance-obligations');
const evaluateBtn = document.getElementById('mission-assurance-evaluate-btn');
const refreshBtn = document.getElementById('mission-assurance-refresh-btn');

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function prettyLabel(value = '') {
    return String(value)
        .split(/[_-]+/)
        .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
        .join(' ');
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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('The server returned an unexpected response.');
    }

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        const firstError = payload.errors && payload.errors.length ? payload.errors[0] : payload.message;
        throw new Error(firstError || 'The request could not be completed.');
    }

    return payload.data;
}

function renderPrinciples(items = []) {
    if (!principlesEl) {
        return;
    }

    principlesEl.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <p class="fw-semibold mb-2">${escapeHtml(item.label)}</p>
                <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');
}

function renderControls(items = []) {
    if (!controlsEl) {
        return;
    }

    controlsEl.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <p class="fw-semibold mb-2">${escapeHtml(item.label)}</p>
                <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');
}

function renderProfile(profile = {}) {
    if (roleEl) {
        roleEl.textContent = prettyLabel(profile.missionRole || '-');
    }

    if (clearanceEl) {
        clearanceEl.textContent = prettyLabel(profile.clearance || '-');
    }

    if (missionsEl) {
        missionsEl.textContent = String((profile.assignedMissions || []).length);
    }

    if (!profileEl) {
        return;
    }

    profileEl.innerHTML = `
        <dl class="row mb-0">
            <dt class="col-sm-5">Display name</dt>
            <dd class="col-sm-7">${escapeHtml(profile.displayName || 'Current user')}</dd>
            <dt class="col-sm-5">Unit</dt>
            <dd class="col-sm-7">${escapeHtml(profile.unit || '-')}</dd>
            <dt class="col-sm-5">Device trust</dt>
            <dd class="col-sm-7">${escapeHtml(prettyLabel(profile.deviceTier || '-'))}</dd>
            <dt class="col-sm-5">Network zones</dt>
            <dd class="col-sm-7">${escapeHtml((profile.networkZones || []).join(', ') || '-')}</dd>
            <dt class="col-sm-5">MFA state</dt>
            <dd class="col-sm-7">${profile.mfaVerified ? 'Verified' : 'Not verified'}</dd>
            <dt class="col-sm-5">Break-glass</dt>
            <dd class="col-sm-7">${profile.breakGlassApproved ? `Approved: ${escapeHtml(profile.breakGlassReason || 'Justification recorded')}` : 'Inactive'}</dd>
            <dt class="col-sm-5">Assigned missions</dt>
            <dd class="col-sm-7">${escapeHtml((profile.assignedMissions || []).join(', ') || '-')}</dd>
        </dl>
    `;
}

function populateSelect(selectEl, items = [], labelField = 'label') {
    if (!selectEl) {
        return;
    }

    selectEl.innerHTML = items.map((item) => `
        <option value="${escapeHtml(item.id)}">${escapeHtml(item[labelField])}</option>
    `).join('');
}

function renderMatrix(matrix = {}) {
    if (sensitiveCountEl) {
        sensitiveCountEl.textContent = String(matrix.allowedCount || 0);
    }

    if (!matrixEl) {
        return;
    }

    const rows = Array.isArray(matrix.entries) ? matrix.entries : [];
    matrixEl.innerHTML = rows.map((entry) => `
        <div class="playwright-scenario-card mb-3">
            <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(entry.actionLabel)}</p>
                    <h3 class="h6 mb-1">${escapeHtml(entry.resourceTitle)}</h3>
                </div>
                <span class="badge text-bg-${entry.allowed ? 'success' : 'danger'}">${entry.allowed ? 'Allow' : 'Deny'}</span>
            </div>
            <p class="text-muted mb-2">${escapeHtml(entry.summary)}</p>
            ${entry.failedChecks && entry.failedChecks.length
        ? `<p class="small mb-0"><strong>Failed checks:</strong> ${escapeHtml(entry.failedChecks.join(', '))}</p>`
        : '<p class="small mb-0"><strong>All gates satisfied.</strong></p>'}
        </div>
    `).join('');
}

function renderDecision(result = null) {
    if (!result) {
        if (decisionBadgeEl) {
            decisionBadgeEl.className = 'badge text-bg-light';
            decisionBadgeEl.textContent = 'Awaiting evaluation';
        }
        if (decisionSummaryEl) {
            decisionSummaryEl.innerHTML = '<p class="text-muted mb-0">Choose a persona, action, and resource to simulate a policy decision.</p>';
        }
        if (checksEl) {
            checksEl.innerHTML = '';
        }
        if (obligationsEl) {
            obligationsEl.innerHTML = '<p class="text-muted mb-0">No follow-up obligations yet.</p>';
        }
        return;
    }

    if (decisionBadgeEl) {
        decisionBadgeEl.className = `badge text-bg-${result.allowed ? 'success' : 'danger'}`;
        decisionBadgeEl.textContent = result.allowed ? 'ALLOW' : 'DENY';
    }

    if (decisionSummaryEl) {
        decisionSummaryEl.innerHTML = `
            <p class="mb-2">${escapeHtml(result.summary || '')}</p>
            <p class="text-muted small mb-2"><strong>Persona:</strong> ${escapeHtml(result.subject?.displayName || '-')}</p>
            <p class="text-muted small mb-2"><strong>Action:</strong> ${escapeHtml(result.action?.label || '-')}</p>
            <p class="text-muted small mb-0"><strong>Resource:</strong> ${escapeHtml(result.resource?.title || '-')}</p>
        `;
    }

    if (checksEl) {
        checksEl.innerHTML = (result.checks || []).map((check) => `
            <div class="playwright-prereq-card mb-3">
                <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                    <p class="fw-semibold mb-0">${escapeHtml(check.label)}</p>
                    <span class="badge text-bg-${check.passed ? 'success' : 'danger'}">${check.passed ? 'Pass' : 'Fail'}</span>
                </div>
                <p class="text-muted mb-0">${escapeHtml(check.detail || '')}</p>
            </div>
        `).join('');
    }

    if (obligationsEl) {
        const obligations = Array.isArray(result.obligations) ? result.obligations : [];
        obligationsEl.innerHTML = obligations.length
            ? obligations.map((item) => `<div class="playwright-workflow-step mb-3"><p class="mb-0 text-muted">${escapeHtml(item)}</p></div>`).join('')
            : '<p class="text-muted mb-0">No additional follow-up obligations were generated for this decision.</p>';
    }
}

async function loadOverview() {
    const overview = await requestJson(overviewEndpoint);

    renderProfile(overview.currentProfile);
    renderPrinciples(overview.principles);
    renderControls(overview.recommendedControls);
    renderMatrix(overview.matrix);
    populateSelect(personaSelect, overview.personas || []);
    populateSelect(actionSelect, overview.actions || []);
    populateSelect(resourceSelect, overview.resources || [], 'title');

    if (personaSelect && overview.defaultPersonaId) {
        personaSelect.value = overview.defaultPersonaId;
    }
    if (actionSelect && overview.defaultActionId) {
        actionSelect.value = overview.defaultActionId;
    }
    if (resourceSelect && overview.defaultResourceId) {
        resourceSelect.value = overview.defaultResourceId;
    }
    if (networkSelect && overview.defaultNetworkZone) {
        networkSelect.value = overview.defaultNetworkZone;
    }

    renderDecision(overview.defaultEvaluation);
    renderStatus('Mission Assurance Module ready.', 'secondary');
}

async function evaluateDecision() {
    if (!actionSelect?.value || !resourceSelect?.value) {
        renderStatus('Select both an action and a resource before evaluating a decision.', 'warning');
        return;
    }

    const result = await requestJson(evaluateEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            personaId: personaSelect?.value || 'current-user',
            actionId: actionSelect.value,
            resourceId: resourceSelect.value,
            context: {
                networkZone: networkSelect?.value || '',
                justification: justificationInput?.value || ''
            }
        })
    });

    renderDecision(result);
    renderStatus(`Policy evaluation complete: ${result.decision.toUpperCase()}.`, result.allowed ? 'success' : 'danger');
}

async function initializeMissionAssuranceModule() {
    if (!rootEl) {
        return;
    }

    try {
        await loadOverview();
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Mission Assurance Module.', 'danger');
        return;
    }

    evaluateBtn?.addEventListener('click', async () => {
        try {
            await evaluateDecision();
        } catch (error) {
            renderStatus(error.message || 'The policy decision could not be evaluated.', 'danger');
        }
    });

    refreshBtn?.addEventListener('click', async () => {
        try {
            await loadOverview();
        } catch (error) {
            renderStatus(error.message || 'Unable to refresh the Mission Assurance Module.', 'danger');
        }
    });
}

void initializeMissionAssuranceModule();
