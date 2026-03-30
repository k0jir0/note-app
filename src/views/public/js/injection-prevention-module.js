const rootEl = document.getElementById('injection-prevention-module-root');
const overviewEndpoint = rootEl?.dataset?.injectionPreventionOverviewEndpoint || '/api/injection-prevention/overview';
const evaluateEndpoint = rootEl?.dataset?.injectionPreventionEvaluateEndpoint || '/api/injection-prevention/evaluate';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const dataLayerEl = document.getElementById('injection-prevention-data-layer');
const sanitizeFilterEl = document.getElementById('injection-prevention-sanitize-filter');
const strictQueryEl = document.getElementById('injection-prevention-strict-query');
const requestGuardEl = document.getElementById('injection-prevention-request-guard');
const statusEl = document.getElementById('injection-prevention-status');
const statusCopyEl = document.getElementById('injection-prevention-status-copy');
const controlsEl = document.getElementById('injection-prevention-controls');
const queryPatternsEl = document.getElementById('injection-prevention-query-patterns');
const scenarioSelectEl = document.getElementById('injection-prevention-scenario-select');
const surfaceEl = document.getElementById('injection-prevention-surface');
const payloadEl = document.getElementById('injection-prevention-payload');
const evaluationEl = document.getElementById('injection-prevention-evaluation');
const refreshBtn = document.getElementById('injection-prevention-refresh-btn');
const evaluateBtn = document.getElementById('injection-prevention-evaluate-btn');

let currentScenarios = [];

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function prettyJson(value) {
    return JSON.stringify(value, null, 2);
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

function renderEvaluation(evaluation) {
    if (!evaluationEl) {
        return;
    }

    const findings = Array.isArray(evaluation.findings) ? evaluation.findings : [];
    const findingsHtml = findings.length
        ? findings.map((finding) => `
            <li><code>${escapeHtml(`${finding.surface}.${finding.path}`)}</code> - ${escapeHtml(finding.reason)}</li>
        `).join('')
        : '<li>No unsafe operator-shaped keys were detected.</li>';

    evaluationEl.innerHTML = `
        <div class="playwright-scenario-card">
            <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(evaluation.blocked ? 'reject' : 'allow')}</p>
                    <h3 class="h5 mb-1">${escapeHtml(evaluation.scenario?.label || 'Injection Prevention Decision')}</h3>
                </div>
                <span class="badge text-bg-${evaluation.blocked ? 'danger' : 'success'}">${escapeHtml(evaluation.decision)}</span>
            </div>
            <p class="text-muted mb-3">${escapeHtml(evaluation.summary || '')}</p>
            <p class="fw-semibold mb-2">Findings</p>
            <ul class="mb-3">${findingsHtml}</ul>
            <p class="fw-semibold mb-2">Safe alternative</p>
            <pre class="small mb-0"><code>${escapeHtml(prettyJson(evaluation.safeAlternative?.example || {}))}</code></pre>
        </div>
    `;
}

function applyScenarioToForm(scenario) {
    if (!scenario) {
        return;
    }

    if (surfaceEl) {
        surfaceEl.value = scenario.surface || 'body';
    }

    if (payloadEl) {
        payloadEl.value = prettyJson(scenario.payload || {});
    }
}

function renderOverview(overview) {
    const posture = overview.database?.posture || {};
    currentScenarios = Array.isArray(overview.scenarios) ? overview.scenarios : [];

    if (dataLayerEl) {
        dataLayerEl.textContent = overview.database?.accessLayer || 'Unknown';
    }

    if (sanitizeFilterEl) {
        sanitizeFilterEl.textContent = posture.sanitizeFilter ? 'Enabled' : 'Disabled';
    }

    if (strictQueryEl) {
        strictQueryEl.textContent = posture.strictQuery ? 'Enabled' : 'Disabled';
    }

    if (requestGuardEl) {
        requestGuardEl.textContent = 'Enabled';
    }

    if (statusCopyEl) {
        statusCopyEl.textContent = overview.database?.equivalentControl || 'Structured query posture not available.';
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

    if (queryPatternsEl) {
        queryPatternsEl.innerHTML = (overview.queryPatterns || []).map((pattern) => `
            <div class="playwright-prereq-card">
                <p class="fw-semibold mb-1">${escapeHtml(pattern.label)}</p>
                <p class="text-muted small mb-2">${escapeHtml(pattern.intent)}</p>
                <p class="text-muted small mb-2"><code>${escapeHtml(pattern.route)}</code></p>
                <pre class="small mb-0"><code>${escapeHtml(prettyJson(pattern.queryShape || {}))}</code></pre>
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
        applyScenarioToForm(overview.defaultEvaluation.scenario);
        renderEvaluation(overview.defaultEvaluation);
    }
}

async function loadOverview() {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);
    renderStatus('Query Injection Prevention Module ready.', 'secondary');
}

async function evaluateScenario() {
    let payload = {};

    try {
        payload = payloadEl?.value ? JSON.parse(payloadEl.value) : {};
    } catch (_error) {
        throw new Error('Payload JSON must be valid.');
    }

    const evaluation = await requestJson(evaluateEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            scenarioId: scenarioSelectEl?.value || '',
            surface: surfaceEl?.value || 'body',
            payload
        })
    });

    renderEvaluation(evaluation);
    renderStatus(
        evaluation.blocked
            ? 'The scenario was rejected before it could reach the data layer.'
            : 'The scenario is shaped like a safe structured request.',
        evaluation.blocked ? 'warning' : 'success'
    );
}

if (rootEl) {
    refreshBtn?.addEventListener('click', () => {
        loadOverview().catch((error) => {
            renderStatus(error.message || 'Unable to refresh the Query Injection Prevention Module.', 'danger');
        });
    });

    scenarioSelectEl?.addEventListener('change', () => {
        const scenario = currentScenarios.find((entry) => entry.id === scenarioSelectEl.value);
        applyScenarioToForm(scenario);
    });

    evaluateBtn?.addEventListener('click', () => {
        evaluateScenario().catch((error) => {
            renderStatus(error.message || 'Unable to evaluate the injection-prevention scenario.', 'danger');
        });
    });

    loadOverview().catch((error) => {
        renderStatus(error.message || 'Unable to load the Query Injection Prevention Module.', 'danger');
    });
}
