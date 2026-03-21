const csrfToken = window.getCsrfToken();
const rootEl = document.getElementById('ml-module-root');
const overviewEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.mlOverviewEndpoint || '/api/ml/overview' : '/api/ml/overview';
const trainEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.mlTrainEndpoint || '/api/ml/train' : '/api/ml/train';

const statusTarget = document.getElementById('ml-status');
const modelStateEl = document.getElementById('ml-model-state');
const modelTrainedAtEl = document.getElementById('ml-model-trained-at');
const trainableCountEl = document.getElementById('ml-trainable-count');
const projectTrainableCountEl = document.getElementById('ml-project-trainable-count');
const alertTotalCountEl = document.getElementById('ml-alert-total-count');
const modelBadgeEl = document.getElementById('ml-model-badge');
const modelTypeBadgeEl = document.getElementById('ml-model-type-badge');
const modelSummaryEl = document.getElementById('ml-model-summary');
const trainingMetricsEl = document.getElementById('ml-training-metrics');
const userFeedbackGrid = document.getElementById('ml-user-feedback-grid');
const projectFeedbackGrid = document.getElementById('ml-project-feedback-grid');
const scoreLabelGrid = document.getElementById('ml-score-label-grid');
const scoreSourceGrid = document.getElementById('ml-score-source-grid');
const recentAlertsGrid = document.getElementById('ml-recent-alerts-grid');
const refreshBtn = document.getElementById('ml-refresh-btn');
const refreshAlertsBtn = document.getElementById('ml-refresh-alerts-btn');
const trainHybridBtn = document.getElementById('ml-train-hybrid-btn');
const trainBootstrapBtn = document.getElementById('ml-train-bootstrap-btn');

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

function formatDate(value) {
    if (!value) {
        return 'Not trained yet';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not trained yet' : parsed.toLocaleString();
}

function formatPercent(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(1)}%` : 'n/a';
}

function formatScore(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

function titleize(value = '') {
    const text = String(value).replaceAll('_', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderMetricCards(target, items = [], emptyMessage) {
    if (!target) {
        return;
    }

    if (!items.length) {
        target.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">${escapeHtml(emptyMessage)}</div>
            </div>
        `;
        return;
    }

    target.innerHTML = items.map((item) => `
        <div class="col-sm-6">
            <div class="research-panel h-100">
                <p class="research-kicker mb-1">${escapeHtml(titleize(item.label))}</p>
                <p class="display-6 mb-0">${escapeHtml(item.count)}</p>
            </div>
        </div>
    `).join('');
}

function renderModelSummary(model = {}) {
    if (!modelSummaryEl || !trainingMetricsEl) {
        return;
    }

    const available = Boolean(model.available);
    modelStateEl.textContent = available ? 'Trained' : 'Heuristic';
    modelTrainedAtEl.textContent = available ? `Last trained ${formatDate(model.trainedAt)}` : 'No trained artifact loaded yet.';
    modelBadgeEl.className = `badge text-bg-${available ? 'success' : 'secondary'}`;
    modelBadgeEl.textContent = available ? 'Trained Model Active' : 'Heuristic Fallback';
    modelTypeBadgeEl.textContent = available ? `${titleize(model.modelType || 'model')} active` : 'Awaiting model';

    modelSummaryEl.innerHTML = `
        <dl class="automation-metadata mb-0">
            <div><dt>Status</dt><dd>${available ? 'Loaded from disk' : 'No runtime artifact loaded'}</dd></div>
            <div><dt>Artifact path</dt><dd>${escapeHtml(model.path || 'Not configured')}</dd></div>
            <div><dt>Score source</dt><dd>${escapeHtml(model.scoreSource || 'heuristic-baseline')}</dd></div>
            <div><dt>Training samples</dt><dd>${escapeHtml(model.trainingSamples || 0)}</dd></div>
            <div><dt>Positive samples</dt><dd>${escapeHtml(model.positiveSamples || 0)}</dd></div>
            <div><dt>Negative samples</dt><dd>${escapeHtml(model.negativeSamples || 0)}</dd></div>
        </dl>
    `;

    trainingMetricsEl.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="research-panel h-100">
                    <p class="research-kicker mb-1">Accuracy</p>
                    <p class="display-6 mb-0">${escapeHtml(formatPercent(model.metrics && model.metrics.accuracy))}</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="research-panel h-100">
                    <p class="research-kicker mb-1">Precision</p>
                    <p class="display-6 mb-0">${escapeHtml(formatPercent(model.metrics && model.metrics.precision))}</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="research-panel h-100">
                    <p class="research-kicker mb-1">Recall</p>
                    <p class="display-6 mb-0">${escapeHtml(formatPercent(model.metrics && model.metrics.recall))}</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="research-panel h-100">
                    <p class="research-kicker mb-1">Loss</p>
                    <p class="display-6 mb-0">${escapeHtml(Number(model.metrics && model.metrics.loss || 0).toFixed(3))}</p>
                </div>
            </div>
        </div>
    `;
}

function renderRecentAlerts(alerts = []) {
    if (!recentAlertsGrid) {
        return;
    }

    if (!alerts.length) {
        recentAlertsGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No alerts are available yet. Analyze logs in the Security Module first, then label a few alerts and return here.</div>
            </div>
        `;
        return;
    }

    recentAlertsGrid.innerHTML = alerts.map((alert) => {
        const reasons = Array.isArray(alert.mlReasons) ? alert.mlReasons.slice(0, 3) : [];

        return `
            <div class="col-lg-6 mb-3">
                <div class="card h-100 security-alert-card severity-${escapeHtml(alert.severity || 'low')}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2 gap-3">
                            <span class="badge text-bg-light text-uppercase">${escapeHtml(alert.severity || 'low')}</span>
                            <small class="text-muted">${escapeHtml(formatDate(alert.detectedAt))}</small>
                        </div>
                        <h3 class="h6 mb-2">${escapeHtml(alert.summary || 'Scored alert')}</h3>
                        <p class="small mb-1"><strong>Score:</strong> ${escapeHtml(formatScore(alert.mlScore))} (${escapeHtml(alert.mlLabel || 'low')})</p>
                        <p class="small text-muted mb-2"><strong>Feedback:</strong> ${escapeHtml(titleize(alert.feedback && alert.feedback.label ? alert.feedback.label : 'unreviewed'))} · ${escapeHtml(alert.scoreSource || 'heuristic-baseline')}</p>
                        <div class="small text-muted">
                            ${reasons.length ? reasons.map((reason) => `<div>&rsaquo; ${escapeHtml(reason)}</div>`).join('') : 'No model rationale available yet.'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function fetchOverview() {
    const response = await fetch(overviewEndpoint, {
        headers: {
            Accept: 'application/json'
        }
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Unable to load ML module overview');
    }

    return payload.data;
}

function renderOverview(data) {
    renderModelSummary(data.model || {});
    trainableCountEl.textContent = String((data.training && data.training.currentUserTrainableCount) || 0);
    projectTrainableCountEl.textContent = String((data.training && data.training.projectTrainableCount) || 0);
    alertTotalCountEl.textContent = String((data.alerts && data.alerts.totalCount) || 0);

    renderMetricCards(
        userFeedbackGrid,
        data.training && Array.isArray(data.training.currentUserFeedbackCounts) ? data.training.currentUserFeedbackCounts : [],
        'No analyst feedback has been recorded for this user yet.'
    );
    renderMetricCards(
        projectFeedbackGrid,
        data.training && Array.isArray(data.training.projectFeedbackCounts) ? data.training.projectFeedbackCounts : [],
        'No project-wide training labels are available yet.'
    );
    renderMetricCards(
        scoreLabelGrid,
        data.alerts && Array.isArray(data.alerts.scoreLabelCounts) ? data.alerts.scoreLabelCounts : [],
        'No score labels are available yet.'
    );
    renderMetricCards(
        scoreSourceGrid,
        data.alerts && Array.isArray(data.alerts.scoreSourceCounts) ? data.alerts.scoreSourceCounts : [],
        'No score sources are available yet.'
    );
    renderRecentAlerts(data.alerts && Array.isArray(data.alerts.recentAlerts) ? data.alerts.recentAlerts : []);
}

async function trainModel(mode) {
    const response = await fetch(trainEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            Accept: 'application/json'
        },
        body: JSON.stringify({
            mode,
            syntheticCount: mode === 'bootstrap' ? 1000 : 600
        })
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Training failed');
    }

    return payload.data;
}

async function refreshModule(showMessage = false) {
    const overview = await fetchOverview();
    renderOverview(overview);
    if (showMessage) {
        renderStatus('ML module refreshed.', 'secondary');
    }
}

async function handleTraining(mode) {
    const label = mode === 'bootstrap' ? 'bootstrap' : 'hybrid';
    renderStatus(`Training the ${label} model. This may take a moment...`, 'info');

    try {
        const result = await trainModel(mode);
        await refreshModule(false);
        renderStatus(`Finished training the ${label} model with ${result.model.trainingSamples} sample(s). Rescored ${result.rescoredAlerts} stored alert(s).`, 'success');
    } catch (error) {
        renderStatus(error.message || `Unable to train the ${label} model right now.`, 'danger');
    }
}

async function initializeMlModule() {
    try {
        await refreshModule(false);
        renderStatus('ML module ready. You can inspect the current model or train a new one from this page.', 'secondary');
    } catch (error) {
        renderStatus(error.message || 'Unable to load the ML module.', 'danger');
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        refreshModule(true).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the ML module.', 'danger');
        });
    });
}

if (refreshAlertsBtn) {
    refreshAlertsBtn.addEventListener('click', () => {
        refreshModule(true).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the alert list.', 'danger');
        });
    });
}

if (trainHybridBtn) {
    trainHybridBtn.addEventListener('click', () => {
        handleTraining('mixed');
    });
}

if (trainBootstrapBtn) {
    trainBootstrapBtn.addEventListener('click', () => {
        handleTraining('bootstrap');
    });
}

initializeMlModule();
