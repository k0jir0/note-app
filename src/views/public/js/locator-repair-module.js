const rootEl = document.getElementById('locator-repair-module-root');
const overviewEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.locatorRepairOverviewEndpoint || '/api/locator-repair/overview'
    : '/api/locator-repair/overview';
const suggestEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.locatorRepairSuggestEndpoint || '/api/locator-repair/suggest'
    : '/api/locator-repair/suggest';
const historyEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.locatorRepairHistoryEndpoint || '/api/locator-repair/history'
    : '/api/locator-repair/history';
const feedbackEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.locatorRepairFeedbackEndpoint || '/api/locator-repair/feedback'
    : '/api/locator-repair/feedback';
const trainEndpoint = rootEl && rootEl.dataset
    ? rootEl.dataset.locatorRepairTrainEndpoint || '/api/locator-repair/train'
    : '/api/locator-repair/train';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const statusTarget = document.getElementById('locator-repair-status');
const runtimeLabelEl = document.getElementById('locator-repair-runtime-label');
const sampleCountEl = document.getElementById('locator-repair-sample-count');
const familyCountEl = document.getElementById('locator-repair-family-count');
const feedbackCountEl = document.getElementById('locator-repair-feedback-count');
const healedCountEl = document.getElementById('locator-repair-healed-count');
const outputTargetsEl = document.getElementById('locator-repair-output-targets');
const controlsGuideEl = document.getElementById('locator-repair-controls-guide');
const workflowGrid = document.getElementById('locator-repair-workflow-grid');
const ladderGrid = document.getElementById('locator-repair-ladder-grid');
const signalsGrid = document.getElementById('locator-repair-signals-grid');
const sampleGrid = document.getElementById('locator-repair-sample-grid');
const sampleSelect = document.getElementById('locator-repair-sample-select');
const originalLocatorInput = document.getElementById('locator-repair-original-locator');
const stepGoalInput = document.getElementById('locator-repair-step-goal');
const htmlSnippetInput = document.getElementById('locator-repair-html-snippet');
const analysisSummaryEl = document.getElementById('locator-repair-analysis-summary');
const suggestionsEl = document.getElementById('locator-repair-suggestions');
const engineBadgeEl = document.getElementById('locator-repair-engine-badge');
const modelSummaryEl = document.getElementById('locator-repair-model-summary');
const historySummaryEl = document.getElementById('locator-repair-history-summary');
const historyGridEl = document.getElementById('locator-repair-history-grid');
const loadSampleBtn = document.getElementById('locator-repair-load-sample-btn');
const analyzeBtn = document.getElementById('locator-repair-analyze-btn');
const trainBtn = document.getElementById('locator-repair-train-btn');
const refreshHistoryBtn = document.getElementById('locator-repair-refresh-history-btn');

let latestOverview = null;
let latestResult = null;

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function formatDate(value) {
    if (!value) {
        return 'Not trained yet';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not trained yet' : parsed.toLocaleString();
}

function formatPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return '0%';
    }

    return `${Math.round(parsed * 100)}%`;
}

function renderStatus(message, tone = 'secondary') {
    if (!statusTarget) {
        return;
    }

    statusTarget.innerHTML = `<div class="alert alert-${escapeHtml(tone)} mb-0">${escapeHtml(message)}</div>`;
}

async function requestJson(url, fallbackMessage, options = {}) {
    try {
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
            throw new Error(fallbackMessage || 'The server returned an unexpected response.');
        }

        const payload = await response.json();
        if (!response.ok || !payload.success) {
            const firstError = payload.errors && payload.errors.length ? payload.errors[0] : '';
            throw new Error(firstError || payload.message || fallbackMessage || 'The request could not be completed.');
        }

        return payload.data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Could not reach the server. Refresh the page and confirm the app is still running on localhost:3000.');
        }

        throw error;
    }
}

function renderControls(items = []) {
    if (!controlsGuideEl) {
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

function renderWorkflow(items = []) {
    if (!workflowGrid) {
        return;
    }

    workflowGrid.innerHTML = items.map((item) => `
        <div class="playwright-workflow-step">
            <p class="research-kicker mb-2">${escapeHtml(item.label)}</p>
            <p class="mb-0 text-muted">${escapeHtml(item.description)}</p>
        </div>
    `).join('');
}

function renderRepairLadder(items = []) {
    if (!ladderGrid) {
        return;
    }

    ladderGrid.innerHTML = items.map((item) => `
        <div class="playwright-workflow-step">
            <p class="research-kicker mb-2">${escapeHtml(item.label)}</p>
            <p class="mb-0 text-muted">${escapeHtml(item.description)}</p>
        </div>
    `).join('');
}

function renderSignals(items = []) {
    if (!signalsGrid) {
        return;
    }

    signalsGrid.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <p class="fw-semibold mb-2">${escapeHtml(item.label)}</p>
                <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');
}

function loadSampleIntoForm(sampleId) {
    if (!latestOverview || !Array.isArray(latestOverview.sampleCases)) {
        return;
    }

    const sample = latestOverview.sampleCases.find((entry) => entry.id === sampleId)
        || latestOverview.sampleCases.find((entry) => entry.id === latestOverview.defaultSampleId)
        || latestOverview.sampleCases[0];

    if (!sample) {
        return;
    }

    if (sampleSelect) {
        sampleSelect.value = sample.id;
    }

    if (originalLocatorInput) {
        originalLocatorInput.value = sample.originalLocator || '';
    }

    if (stepGoalInput) {
        stepGoalInput.value = sample.stepGoal || '';
    }

    if (htmlSnippetInput) {
        htmlSnippetInput.value = sample.htmlSnippet || '';
    }
}

function renderSampleCases(items = []) {
    if (!sampleGrid) {
        return;
    }

    sampleGrid.innerHTML = items.map((sample) => `
        <div class="col-12">
            <div class="playwright-scenario-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2">
                    <div>
                        <p class="research-kicker mb-1">${escapeHtml(sample.id)}</p>
                        <h3 class="h5 mb-1">${escapeHtml(sample.title)}</h3>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-dark locator-repair-sample-card-btn" data-sample-id="${escapeHtml(sample.id)}">Load</button>
                </div>
                <p class="text-muted mb-3">${escapeHtml(sample.summary)}</p>
                <p class="small fw-semibold mb-1">Original locator</p>
                <pre class="playwright-script-preview mb-3"><code>${escapeHtml(sample.originalLocator)}</code></pre>
                <p class="small fw-semibold mb-1">Step goal</p>
                <p class="text-muted small mb-0">${escapeHtml(sample.stepGoal)}</p>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.locator-repair-sample-card-btn').forEach((button) => {
        button.addEventListener('click', () => {
            loadSampleIntoForm(button.getAttribute('data-sample-id') || '');
            renderStatus(`Loaded sample case ${button.getAttribute('data-sample-id') || ''}.`, 'secondary');
        });
    });
}

function populateSampleSelect(items = [], defaultSampleId = '') {
    if (!sampleSelect) {
        return;
    }

    sampleSelect.innerHTML = items.map((sample) => `
        <option value="${escapeHtml(sample.id)}">${escapeHtml(sample.title)}</option>
    `).join('');

    if (defaultSampleId) {
        sampleSelect.value = defaultSampleId;
    }
}

function renderModelSummary(model = {}) {
    if (!modelSummaryEl) {
        return;
    }

    const available = Boolean(model.available);
    modelSummaryEl.innerHTML = `
        <dl class="row mb-0">
            <dt class="col-sm-5">Status</dt>
            <dd class="col-sm-7">${available ? 'Model active' : 'Heuristic fallback'}</dd>
            <dt class="col-sm-5">Source</dt>
            <dd class="col-sm-7">${escapeHtml(model.source || 'unknown')}</dd>
            <dt class="col-sm-5">Artifact</dt>
            <dd class="col-sm-7">${escapeHtml(model.path || 'Not configured')}</dd>
            <dt class="col-sm-5">Trained</dt>
            <dd class="col-sm-7">${escapeHtml(formatDate(model.trainedAt))}</dd>
            <dt class="col-sm-5">Samples</dt>
            <dd class="col-sm-7">${escapeHtml(String(model.trainingSamples || 0))}</dd>
            <dt class="col-sm-5">Accuracy</dt>
            <dd class="col-sm-7">${escapeHtml(formatPercent(model.metrics && model.metrics.accuracy))}</dd>
        </dl>
    `;
}

function renderHistory(summary = {}, entries = []) {
    const recentEntries = entries.length ? entries : (summary.recentEntries || []);

    if (feedbackCountEl) {
        feedbackCountEl.textContent = String(summary.totalEntries || 0);
    }

    if (healedCountEl) {
        healedCountEl.textContent = String(summary.healedCount || 0);
    }

    if (historySummaryEl) {
        const topStrategies = Array.isArray(summary.topStrategies) ? summary.topStrategies : [];
        historySummaryEl.innerHTML = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="playwright-prereq-card h-100">
                        <p class="fw-semibold mb-1">Accepted</p>
                        <p class="display-6 mb-1">${escapeHtml(String(summary.acceptedCount || 0))}</p>
                        <p class="text-muted small mb-0">Repairs a reviewer accepted.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="playwright-prereq-card h-100">
                        <p class="fw-semibold mb-1">Rejected</p>
                        <p class="display-6 mb-1">${escapeHtml(String(summary.rejectedCount || 0))}</p>
                        <p class="text-muted small mb-0">Candidates that were explicitly marked incorrect.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="playwright-prereq-card h-100">
                        <p class="fw-semibold mb-1">Top Strategies</p>
                        <p class="text-muted small mb-0">${topStrategies.length
        ? topStrategies.map((item) => `${escapeHtml(item.label)} (${escapeHtml(String(item.count))})`).join(', ')
        : 'No feedback recorded yet.'}</p>
                    </div>
                </div>
            </div>
        `;
    }

    if (!historyGridEl) {
        return;
    }

    historyGridEl.innerHTML = recentEntries.length
        ? recentEntries.map((entry) => `
            <div class="playwright-workflow-step">
                <div class="d-flex justify-content-between gap-3 flex-wrap mb-2">
                    <p class="fw-semibold mb-0">${escapeHtml(entry.feedbackLabel || 'accepted')} &middot; ${escapeHtml(entry.primaryLocator && entry.primaryLocator.strategy ? entry.primaryLocator.strategy : 'unknown')}</p>
                    <span class="badge text-bg-${entry.verified ? 'success' : 'secondary'}">${entry.verified ? 'verified' : 'reviewed'}</span>
                </div>
                <p class="text-muted small mb-1">${escapeHtml(entry.route || 'No route recorded')} ${entry.scenarioId ? `&middot; ${escapeHtml(entry.scenarioId)}` : ''}</p>
                <p class="text-muted small mb-0">Hybrid score ${escapeHtml(String(Math.round((Number(entry.hybridScore || 0) * 100))))}% &middot; ${escapeHtml(entry.confidence || 'low')} confidence</p>
            </div>
        `).join('')
        : '<div class="alert alert-secondary mb-0">No repair feedback has been recorded yet.</div>';
}

function renderOverview(overview) {
    latestOverview = overview;

    if (runtimeLabelEl) {
        runtimeLabelEl.textContent = overview.module.runtime || 'ML-assisted self-healing';
    }

    if (sampleCountEl) {
        sampleCountEl.textContent = String(overview.coverage.sampleCaseCount || 0);
    }

    if (familyCountEl) {
        familyCountEl.textContent = String(overview.coverage.supportedLocatorFamilyCount || 0);
    }

    if (feedbackCountEl) {
        feedbackCountEl.textContent = String(overview.coverage.feedbackEntryCount || 0);
    }

    if (healedCountEl) {
        healedCountEl.textContent = String(overview.coverage.verifiedHealCount || 0);
    }

    if (outputTargetsEl) {
        outputTargetsEl.textContent = overview.module.targetFrameworks || 'Playwright and Selenium';
    }

    renderControls(Array.isArray(overview.controls) ? overview.controls : []);
    renderWorkflow(Array.isArray(overview.workflow) ? overview.workflow : []);
    renderRepairLadder(Array.isArray(overview.repairLadder) ? overview.repairLadder : []);
    renderSignals(Array.isArray(overview.supportedSignals) ? overview.supportedSignals : []);
    renderSampleCases(Array.isArray(overview.sampleCases) ? overview.sampleCases : []);
    populateSampleSelect(Array.isArray(overview.sampleCases) ? overview.sampleCases : [], overview.defaultSampleId);
    renderModelSummary(overview.model || {});
    renderHistory(overview.history || {}, overview.history && Array.isArray(overview.history.recentEntries) ? overview.history.recentEntries : []);
}

function renderAnalysisSummary(result) {
    if (!analysisSummaryEl) {
        return;
    }

    const detectedSignals = result.analysis && Array.isArray(result.analysis.detectedSignals)
        ? result.analysis.detectedSignals
        : [];
    const warnings = result.analysis && Array.isArray(result.analysis.warnings)
        ? result.analysis.warnings
        : [];

    analysisSummaryEl.innerHTML = `
        <div class="mb-3">
            <p class="fw-semibold mb-1">Locator family</p>
            <p class="mb-0">${escapeHtml(result.analysis && result.analysis.locatorFamily ? result.analysis.locatorFamily : 'unknown')}</p>
        </div>
        <div class="mb-3">
            <p class="fw-semibold mb-1">Interactive candidates</p>
            <p class="mb-0">${escapeHtml(String(result.analysis && typeof result.analysis.candidateCount === 'number' ? result.analysis.candidateCount : 0))}</p>
        </div>
        <div class="mb-3">
            <p class="fw-semibold mb-1">Auto-heal ready</p>
            <p class="mb-0">${escapeHtml(String(result.analysis && typeof result.analysis.autoHealReadyCount === 'number' ? result.analysis.autoHealReadyCount : 0))}</p>
        </div>
        <div class="mb-3">
            <p class="fw-semibold mb-2">Detected signals</p>
            ${detectedSignals.length
        ? `<ul class="mb-0">${detectedSignals.map((signal) => `
                        <li class="text-muted small mb-2">
                            <span class="fw-semibold">${escapeHtml(signal.label)}</span>
                            <div>${escapeHtml(signal.value)}</div>
                        </li>
                    `).join('')}</ul>`
        : '<div class="alert alert-secondary mb-0">No explicit signals were extracted from the original locator.</div>'}
        </div>
        <div>
            <p class="fw-semibold mb-2">Warnings</p>
            ${warnings.length
        ? `<ul class="mb-0">${warnings.map((warning) => `<li class="text-muted small mb-2">${escapeHtml(warning)}</li>`).join('')}</ul>`
        : '<div class="alert alert-success mb-0">No additional repair warnings were generated for this input.</div>'}
        </div>
    `;
}

function formatStableSignals(candidate = {}) {
    return [
        candidate.dataTestId ? `data-testid=${candidate.dataTestId}` : '',
        candidate.id ? `id=${candidate.id}` : '',
        candidate.href ? `href=${candidate.href}` : '',
        candidate.name ? `name=${candidate.name}` : '',
        candidate.placeholder ? `placeholder=${candidate.placeholder}` : ''
    ].filter(Boolean).join(', ') || 'No strong attribute signals detected.';
}

function buildCurrentPayload() {
    return {
        locator: originalLocatorInput ? originalLocatorInput.value.trim() : '',
        stepGoal: stepGoalInput ? stepGoalInput.value.trim() : '',
        htmlSnippet: htmlSnippetInput ? htmlSnippetInput.value : ''
    };
}

function bindFeedbackButtons() {
    document.querySelectorAll('.locator-repair-feedback-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const feedbackLabel = button.getAttribute('data-feedback-label') || 'accepted';
            const selectedFingerprint = button.getAttribute('data-fingerprint') || '';

            try {
                renderStatus(`Recording ${feedbackLabel} feedback...`, 'info');
                await requestJson(feedbackEndpoint, 'Unable to record self-healing feedback.', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken
                    },
                    body: JSON.stringify({
                        ...buildCurrentPayload(),
                        selectedFingerprint,
                        feedbackLabel,
                        verified: feedbackLabel === 'healed',
                        framework: 'module-page',
                        route: '/self-healing/module'
                    })
                });

                await refreshModule(false);
                await refreshHistory();
                renderStatus(`Recorded ${feedbackLabel} feedback and refreshed the self-healing model state.`, 'success');
            } catch (error) {
                renderStatus(error.message || 'Unable to record feedback.', 'danger');
            }
        });
    });
}

function renderSuggestions(result) {
    latestResult = result;

    if (!suggestionsEl) {
        return;
    }

    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    suggestionsEl.innerHTML = suggestions.map((suggestion) => `
        <div class="playwright-scenario-card mb-3">
            <div class="d-flex justify-content-between gap-3 mb-3 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">Suggestion ${escapeHtml(String(suggestion.rank || 0))}</p>
                    <h3 class="h5 mb-1">${escapeHtml((suggestion.primaryLocator && suggestion.primaryLocator.strategy) || 'Fallback repair')}</h3>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    <span class="badge text-bg-${suggestion.confidence === 'high' ? 'success' : suggestion.confidence === 'medium' ? 'warning' : 'secondary'}">${escapeHtml(`Confidence: ${suggestion.confidence || 'low'}`)}</span>
                    <span class="badge text-bg-light">${escapeHtml(`Hybrid: ${suggestion.score || 0}`)}</span>
                    <span class="badge text-bg-${suggestion.healDecision && suggestion.healDecision.autoApplyEligible ? 'success' : 'secondary'}">${escapeHtml(suggestion.healDecision && suggestion.healDecision.autoApplyEligible ? 'Auto-heal ready' : 'Review first')}</span>
                </div>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <p class="fw-semibold mb-1">Playwright</p>
                    <pre class="playwright-script-preview mb-0"><code>${escapeHtml(suggestion.primaryLocator ? suggestion.primaryLocator.playwright : 'No locator available')}</code></pre>
                </div>
                <div class="col-md-6">
                    <p class="fw-semibold mb-1">Selenium</p>
                    <pre class="playwright-script-preview mb-0"><code>${escapeHtml(suggestion.primaryLocator ? suggestion.primaryLocator.selenium : 'No locator available')}</code></pre>
                </div>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <p class="fw-semibold mb-2">Heuristic reasons</p>
                    <ul class="mb-0">
                        ${(Array.isArray(suggestion.reasons) ? suggestion.reasons : []).map((reason) => `<li class="text-muted small mb-2">${escapeHtml(reason)}</li>`).join('')}
                    </ul>
                </div>
                <div class="col-md-6">
                    <p class="fw-semibold mb-2">Model reasons</p>
                    <ul class="mb-0">
                        ${(suggestion.ml && Array.isArray(suggestion.ml.reasons) ? suggestion.ml.reasons : []).map((reason) => `<li class="text-muted small mb-2">${escapeHtml(reason)}</li>`).join('') || '<li class="text-muted small mb-2">No trained model rationale was available.</li>'}
                    </ul>
                </div>
            </div>
            <div class="mb-3">
                <p class="fw-semibold mb-2">Candidate summary</p>
                <ul class="mb-0">
                    <li class="text-muted small mb-2"><span class="fw-semibold">Tag</span><div>${escapeHtml(suggestion.candidate && suggestion.candidate.tag ? suggestion.candidate.tag : '')}</div></li>
                    <li class="text-muted small mb-2"><span class="fw-semibold">Role</span><div>${escapeHtml(suggestion.candidate && suggestion.candidate.role ? suggestion.candidate.role : '')}</div></li>
                    <li class="text-muted small mb-2"><span class="fw-semibold">Accessible name</span><div>${escapeHtml(suggestion.candidate && suggestion.candidate.accessibleName ? suggestion.candidate.accessibleName : '')}</div></li>
                    <li class="text-muted small mb-2"><span class="fw-semibold">Stable signals</span><div>${escapeHtml(formatStableSignals(suggestion.candidate || {}))}</div></li>
                    <li class="text-muted small mb-0"><span class="fw-semibold">Self-heal gate</span><div>${escapeHtml(suggestion.healDecision && suggestion.healDecision.reason ? suggestion.healDecision.reason : 'No self-heal decision available.')}</div></li>
                </ul>
            </div>
            ${(Array.isArray(suggestion.alternativeLocators) && suggestion.alternativeLocators.length)
        ? `
                <div class="mb-3">
                    <p class="fw-semibold mb-2">Fallback locators</p>
                    <ul class="mb-0">
                        ${suggestion.alternativeLocators.map((alternative) => `
                            <li class="text-muted small mb-3">
                                <span class="fw-semibold">${escapeHtml(alternative.strategy)} (${escapeHtml(alternative.stability)})</span>
                                <div><code>${escapeHtml(alternative.playwright)}</code></div>
                                <div><code>${escapeHtml(alternative.selenium)}</code></div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `
        : ''}
            <div class="d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-sm btn-outline-success locator-repair-feedback-btn" data-feedback-label="accepted" data-fingerprint="${escapeHtml(suggestion.candidate && suggestion.candidate.fingerprint ? suggestion.candidate.fingerprint : '')}">Accept</button>
                <button type="button" class="btn btn-sm btn-outline-danger locator-repair-feedback-btn" data-feedback-label="rejected" data-fingerprint="${escapeHtml(suggestion.candidate && suggestion.candidate.fingerprint ? suggestion.candidate.fingerprint : '')}">Reject</button>
                <button type="button" class="btn btn-sm btn-outline-primary locator-repair-feedback-btn" data-feedback-label="healed" data-fingerprint="${escapeHtml(suggestion.candidate && suggestion.candidate.fingerprint ? suggestion.candidate.fingerprint : '')}">Mark Healed</button>
            </div>
        </div>
    `).join('');

    if (engineBadgeEl) {
        const mode = result.engine && result.engine.mode ? result.engine.mode : 'Repair suggestions ready';
        engineBadgeEl.textContent = mode;
    }

    bindFeedbackButtons();
}

async function analyzeLocatorRepairs() {
    const result = await requestJson(suggestEndpoint, 'Unable to analyze the self-healing request.', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify(buildCurrentPayload())
    });

    renderAnalysisSummary(result);
    renderSuggestions(result);
    return result;
}

async function refreshHistory() {
    const history = await requestJson(historyEndpoint, 'Unable to load self-healing history.');
    renderHistory(history.summary || {}, Array.isArray(history.entries) ? history.entries : []);
    return history;
}

async function refreshModule(loadDefaultSample = true) {
    const overview = await requestJson(overviewEndpoint, 'Unable to load the self-healing module overview.');
    renderOverview(overview);

    if (loadDefaultSample) {
        loadSampleIntoForm(overview.defaultSampleId || '');
    }

    return overview;
}

async function trainModel(mode = 'hybrid') {
    return requestJson(trainEndpoint, 'Unable to train the self-healing model.', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ mode })
    });
}

async function initializeLocatorRepairModule() {
    try {
        await refreshModule(true);
        await refreshHistory();
        await analyzeLocatorRepairs();
        renderStatus('Self-Healing Locator Repair Module ready. Analyze a failure, review the self-heal gate, and capture feedback to improve the reranker.', 'secondary');
    } catch (error) {
        renderStatus(error.message || 'Unable to initialize the self-healing module.', 'danger');
    }
}

if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
        loadSampleIntoForm(sampleSelect ? sampleSelect.value : '');
        renderStatus('Loaded the selected sample case.', 'secondary');
    });
}

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
        analyzeLocatorRepairs().then(() => {
            renderStatus('Generated ML-assisted self-healing suggestions.', 'success');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to generate self-healing suggestions.', 'danger');
        });
    });
}

if (trainBtn) {
    trainBtn.addEventListener('click', () => {
        renderStatus('Training the self-healing reranker...', 'info');
        trainModel('hybrid').then(async () => {
            await refreshModule(false);
            await refreshHistory();
            if (latestResult) {
                await analyzeLocatorRepairs();
            }
            renderStatus('Trained the self-healing model and refreshed the latest self-healing state.', 'success');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to train the self-healing model.', 'danger');
        });
    });
}

if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', () => {
        Promise.all([refreshModule(false), refreshHistory()]).then(() => {
            renderStatus('Refreshed the latest model and repair history state.', 'secondary');
        }).catch((error) => {
            renderStatus(error.message || 'Unable to refresh repair history.', 'danger');
        });
    });
}

initializeLocatorRepairModule();
