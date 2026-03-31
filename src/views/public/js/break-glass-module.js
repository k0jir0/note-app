const rootEl = document.getElementById('break-glass-module-root');
const overviewEndpoint = rootEl?.dataset?.breakGlassOverviewEndpoint || '/api/break-glass/overview';
const runtimeEndpoint = rootEl?.dataset?.breakGlassRuntimeEndpoint || '/api/runtime/break-glass';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const modeEl = document.getElementById('break-glass-mode');
const healthStatusEl = document.getElementById('break-glass-health-status');
const authorityEl = document.getElementById('break-glass-authority');
const activatedByEl = document.getElementById('break-glass-activated-by');
const statusEl = document.getElementById('break-glass-status');
const statusCopyEl = document.getElementById('break-glass-status-copy');
const stateCardEl = document.getElementById('break-glass-state-card');
const guidanceEl = document.getElementById('break-glass-guidance');
const modeSelectEl = document.getElementById('break-glass-mode-select');
const reasonEl = document.getElementById('break-glass-reason');
const bypassPathsEl = document.getElementById('break-glass-bypass-paths');
const refreshBtn = document.getElementById('break-glass-refresh-btn');
const applyBtn = document.getElementById('break-glass-apply-btn');

let currentOverview = null;

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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('The server returned an unexpected response.');
    }

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        const firstError = payload.errors && payload.errors.length ? payload.errors[0] : payload.message;
        throw new Error(firstError || 'The request could not be completed.');
    }

    return payload.data || payload.breakGlass || payload;
}

function renderOverview(overview = {}) {
    currentOverview = overview;
    const state = overview.state || {};
    const controls = overview.controls || {};
    const allowedModes = Array.isArray(controls.allowedModes) ? controls.allowedModes : [];

    if (modeEl) {
        modeEl.textContent = state.label || 'Disabled';
    }

    if (healthStatusEl) {
        healthStatusEl.textContent = String((overview.health && overview.health.expectedStatus) || 200);
    }

    if (authorityEl) {
        authorityEl.textContent = controls.canToggle ? 'Authorized' : 'View only';
    }

    if (activatedByEl) {
        activatedByEl.textContent = state.activatedBy || 'Not active';
    }

    if (statusCopyEl) {
        statusCopyEl.textContent = state.enabled
            ? `${state.label} mode is active. ${state.description || ''}`
            : 'Normal operations are active. Use this module to inspect or, if authorized, change the break-glass state.';
    }

    if (stateCardEl) {
        stateCardEl.innerHTML = `
            <div class="playwright-scenario-card">
                <div class="d-flex justify-content-between gap-3 mb-3 flex-wrap">
                    <div>
                        <p class="research-kicker mb-1">${escapeHtml(state.mode || 'disabled')}</p>
                        <h3 class="h5 mb-1">${escapeHtml(state.label || 'Disabled')}</h3>
                    </div>
                    <span class="badge text-bg-${state.offline ? 'danger' : (state.readOnly ? 'warning' : 'success')}">${escapeHtml(state.enabled ? 'Active' : 'Normal')}</span>
                </div>
                <p class="text-muted mb-3">${escapeHtml(state.description || '')}</p>
                <p class="mb-2"><strong>Reason:</strong> ${escapeHtml(state.reason || 'No active emergency reason recorded.')}</p>
                <p class="mb-2"><strong>Activated at:</strong> ${escapeHtml(state.activatedAt || 'Not active')}</p>
                <p class="mb-0"><strong>Health endpoint:</strong> ${escapeHtml(overview.health?.endpoint || '/healthz')} should return ${escapeHtml(String(overview.health?.expectedStatus || 200))}</p>
            </div>
        `;
    }

    if (guidanceEl) {
        guidanceEl.innerHTML = (overview.guidance || []).map((item) => `
            <div class="col-md-6">
                <div class="playwright-prereq-card h-100">
                    <p class="fw-semibold mb-2">${escapeHtml(item.label)}</p>
                    <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
                </div>
            </div>
        `).join('');
    }

    if (modeSelectEl) {
        modeSelectEl.innerHTML = allowedModes.map((mode) => `
            <option value="${escapeHtml(mode.id)}">${escapeHtml(mode.label)}</option>
        `).join('');
        modeSelectEl.value = state.mode || 'disabled';
        modeSelectEl.disabled = !controls.canToggle;
    }

    if (reasonEl) {
        reasonEl.value = state.reason || '';
        reasonEl.disabled = !controls.canToggle;
    }

    if (applyBtn) {
        applyBtn.disabled = !controls.canToggle;
    }

    if (bypassPathsEl) {
        bypassPathsEl.innerHTML = `
            <div class="playwright-prereq-card">
                <p class="fw-semibold mb-2">Safe bypass paths</p>
                <ul class="mb-0">
                    ${(controls.safeBypassPaths || []).map((entry) => `<li><code>${escapeHtml(entry)}</code></li>`).join('')}
                </ul>
            </div>
        `;
    }
}

async function loadOverview(showMessage = false) {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);

    if (showMessage) {
        renderStatus('Break-glass module refreshed.', 'secondary');
    } else {
        renderStatus('Break-glass module ready.', 'secondary');
    }
}

async function applyBreakGlassMode() {
    const mode = modeSelectEl?.value || 'disabled';
    const reason = reasonEl?.value || '';

    await requestJson(runtimeEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ mode, reason })
    });

    await loadOverview(false);
    renderStatus(`Break-glass mode updated to ${mode}.`, mode === 'offline' ? 'danger' : (mode === 'read_only' ? 'warning' : 'success'));
}

async function initializeBreakGlassModule() {
    if (!rootEl) {
        return;
    }

    try {
        await loadOverview(false);
    } catch (error) {
        renderStatus(error.message || 'Unable to load the break-glass module.', 'danger');
        return;
    }

    refreshBtn?.addEventListener('click', async () => {
        try {
            await loadOverview(true);
        } catch (error) {
            renderStatus(error.message || 'Unable to refresh the break-glass module.', 'danger');
        }
    });

    applyBtn?.addEventListener('click', async () => {
        try {
            await applyBreakGlassMode();
        } catch (error) {
            renderStatus(error.message || 'Unable to change the break-glass mode.', 'danger');
        }
    });
}

void initializeBreakGlassModule();