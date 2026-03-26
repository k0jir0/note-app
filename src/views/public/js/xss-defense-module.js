const rootEl = document.getElementById('xss-defense-module-root');
const overviewEndpoint = rootEl?.dataset?.xssDefenseOverviewEndpoint || '/api/xss-defense/overview';
const evaluateEndpoint = rootEl?.dataset?.xssDefenseEvaluateEndpoint || '/api/xss-defense/evaluate';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const templateEngineEl = document.getElementById('xss-defense-template-engine');
const unescapedCountEl = document.getElementById('xss-defense-unescaped-count');
const inlineScriptCountEl = document.getElementById('xss-defense-inline-script-count');
const cspScriptSrcEl = document.getElementById('xss-defense-csp-script-src');
const statusEl = document.getElementById('xss-defense-status');
const statusCopyEl = document.getElementById('xss-defense-status-copy');
const controlsEl = document.getElementById('xss-defense-controls');
const cspDirectivesEl = document.getElementById('xss-defense-csp-directives');
const scenarioSelectEl = document.getElementById('xss-defense-scenario-select');
const payloadEl = document.getElementById('xss-defense-payload');
const evaluationEl = document.getElementById('xss-defense-evaluation');
const refreshBtn = document.getElementById('xss-defense-refresh-btn');
const evaluateBtn = document.getElementById('xss-defense-evaluate-btn');

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

function renderEvaluation(evaluation = {}) {
    if (!evaluationEl) {
        return;
    }

    const signals = Array.isArray(evaluation.dangerSignals) ? evaluation.dangerSignals : [];
    const signalMarkup = signals.length
        ? `<ul class="mb-0">${signals.map((signal) => `<li><strong>${escapeHtml(signal.label)}</strong>: ${escapeHtml(signal.description)} <span class="text-muted">(${escapeHtml(signal.cspMitigation)})</span></li>`).join('')}</ul>`
        : '<p class="text-muted mb-0">No active XSS signal was detected in this payload.</p>';

    evaluationEl.innerHTML = `
        <div class="playwright-scenario-card">
            <div class="d-flex justify-content-between gap-3 mb-3 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(evaluation.decision || 'render-safe')}</p>
                    <h3 class="h5 mb-1">${escapeHtml(evaluation.scenario?.label || 'XSS Defense Decision')}</h3>
                </div>
                <span class="badge text-bg-${signals.length ? 'danger' : 'success'}">${escapeHtml(signals.length ? 'Active signal' : 'Safe text')}</span>
            </div>
            <p class="text-muted mb-3">${escapeHtml(evaluation.summary || '')}</p>
            <div class="mb-3">
                <p class="fw-semibold mb-2">Danger Signals</p>
                ${signalMarkup}
            </div>
            <div class="mb-3">
                <p class="fw-semibold mb-2">Escaped Preview</p>
                <pre class="small mb-0"><code>${escapeHtml(evaluation.escapedPreview || '')}</code></pre>
            </div>
            <div class="mb-3">
                <p class="fw-semibold mb-2">Sanitized Note Preview</p>
                <pre class="small mb-0"><code>${escapeHtml(evaluation.sanitizedPreview || '')}</code></pre>
            </div>
            <div>
                <p class="fw-semibold mb-2">CSP Outcome</p>
                <p class="text-muted mb-0">${escapeHtml(evaluation.cspOutcome?.summary || '')}</p>
            </div>
        </div>
    `;
}

function renderOverview(overview = {}) {
    const serverTemplates = overview.rendering?.serverTemplates || {};
    const clientRendering = overview.rendering?.clientRendering || {};
    const directives = Array.isArray(overview.csp?.directiveList) ? overview.csp.directiveList : [];

    if (templateEngineEl) {
        templateEngineEl.textContent = serverTemplates.escapedInterpolationOnly ? 'EJS escaped' : 'Review needed';
    }

    if (unescapedCountEl) {
        unescapedCountEl.textContent = String((serverTemplates.unescapedTemplateFiles || []).length);
    }

    if (inlineScriptCountEl) {
        inlineScriptCountEl.textContent = String(serverTemplates.inlineScriptTemplateCount || 0);
    }

    if (cspScriptSrcEl) {
        const scriptDirective = directives.find((directive) => directive.name === 'scriptSrc');
        cspScriptSrcEl.textContent = scriptDirective ? scriptDirective.value : '\'self\'';
    }

    if (statusCopyEl) {
        statusCopyEl.textContent = `Escaped EJS only: ${serverTemplates.escapedInterpolationOnly ? 'yes' : 'no'}. Protected DOM sink files: ${(clientRendering.protectedSinkFiles || []).length}/${(clientRendering.innerHtmlSinkFiles || []).length}. CSP enforced with inline script attributes blocked.`;
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

    if (cspDirectivesEl) {
        cspDirectivesEl.innerHTML = directives.map((directive) => `
            <div class="playwright-prereq-card">
                <p class="fw-semibold mb-1">${escapeHtml(directive.name)}</p>
                <pre class="small mb-0"><code>${escapeHtml(directive.value)}</code></pre>
            </div>
        `).join('');
    }

    currentScenarios = Array.isArray(overview.scenarios) ? overview.scenarios : [];
    if (scenarioSelectEl) {
        scenarioSelectEl.innerHTML = currentScenarios.map((scenario) => `
            <option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.label)}</option>
        `).join('');

        if (overview.defaultScenarioId) {
            scenarioSelectEl.value = overview.defaultScenarioId;
        }
    }

    if (payloadEl) {
        const selectedScenario = currentScenarios.find((scenario) => scenario.id === (overview.defaultScenarioId || currentScenarios[0]?.id));
        payloadEl.value = selectedScenario ? selectedScenario.payload : '';
    }

    renderEvaluation(overview.defaultEvaluation || {});
}

async function loadOverview(showMessage = false) {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);

    if (showMessage) {
        renderStatus('XSS Defense Module refreshed.', 'secondary');
    } else {
        renderStatus('XSS Defense Module ready.', 'secondary');
    }
}

async function evaluateScenario() {
    const data = await requestJson(evaluateEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            scenarioId: scenarioSelectEl?.value || '',
            payload: payloadEl?.value || ''
        })
    });

    renderEvaluation(data);
    renderStatus(`Payload evaluation complete: ${data.decision || 'render-safe'}.`, data.dangerSignals && data.dangerSignals.length ? 'danger' : 'success');
}

function updateSelectedScenarioPayload() {
    if (!payloadEl || !scenarioSelectEl) {
        return;
    }

    const selectedScenario = currentScenarios.find((scenario) => scenario.id === scenarioSelectEl.value);
    if (selectedScenario) {
        payloadEl.value = selectedScenario.payload || '';
        renderStatus('Loaded the selected XSS scenario payload.', 'secondary');
    }
}

async function initializeXssDefenseModule() {
    if (!rootEl) {
        return;
    }

    try {
        await loadOverview(false);
    } catch (error) {
        renderStatus(error.message || 'Unable to load the XSS Defense Module.', 'danger');
        return;
    }

    refreshBtn?.addEventListener('click', async () => {
        try {
            await loadOverview(true);
        } catch (error) {
            renderStatus(error.message || 'Unable to refresh the XSS Defense Module.', 'danger');
        }
    });

    scenarioSelectEl?.addEventListener('change', () => {
        updateSelectedScenarioPayload();
    });

    evaluateBtn?.addEventListener('click', async () => {
        try {
            await evaluateScenario();
        } catch (error) {
            renderStatus(error.message || 'Unable to evaluate the XSS payload.', 'danger');
        }
    });
}

void initializeXssDefenseModule();
