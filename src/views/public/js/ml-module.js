const csrfToken = window.getCsrfToken();
const rootEl = document.getElementById('ml-module-root');
const overviewEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.mlOverviewEndpoint || '/api/ml/overview' : '/api/ml/overview';
const trainEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.mlTrainEndpoint || '/api/ml/train' : '/api/ml/train';
const autonomyDemoEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.mlAutonomyDemoEndpoint || '/api/ml/autonomy-demo' : '/api/ml/autonomy-demo';

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
const autonomySummaryEl = document.getElementById('ml-autonomy-summary');
const autonomyOverviewGrid = document.getElementById('ml-autonomy-overview-grid');
const userFeedbackGrid = document.getElementById('ml-user-feedback-grid');
const projectFeedbackGrid = document.getElementById('ml-project-feedback-grid');
const scoreLabelGrid = document.getElementById('ml-score-label-grid');
const scoreSourceGrid = document.getElementById('ml-score-source-grid');
const scoreBucketsGrid = document.getElementById('ml-score-buckets-grid');
const responseLevelGrid = document.getElementById('ml-response-level-grid');
const responseActionGrid = document.getElementById('ml-response-action-grid');
const alertTypeBreakdownEl = document.getElementById('ml-alert-type-breakdown');
const positiveFeaturesEl = document.getElementById('ml-positive-features');
const negativeFeaturesEl = document.getElementById('ml-negative-features');
const recentAlertsGrid = document.getElementById('ml-recent-alerts-grid');
const refreshBtn = document.getElementById('ml-refresh-btn');
const refreshAlertsBtn = document.getElementById('ml-refresh-alerts-btn');
const autonomyDemoBtn = document.getElementById('ml-autonomy-demo-btn');
const trainHybridBtn = document.getElementById('ml-train-hybrid-btn');
const trainBootstrapBtn = document.getElementById('ml-train-bootstrap-btn');
const trainingButtons = [trainHybridBtn, trainBootstrapBtn, autonomyDemoBtn].filter(Boolean);

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

function setTrainingButtonsDisabled(isDisabled) {
    trainingButtons.forEach((button) => {
        button.disabled = isDisabled;
    });
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

function formatResponseSummary(response = {}) {
    if (!response || typeof response !== 'object' || !response.level) {
        return 'No autonomous response recorded yet.';
    }

    const actions = Array.isArray(response.actions) ? response.actions : [];
    if (!actions.length) {
        return response.reason
            ? `${titleize(response.level)}: ${String(response.reason)}`
            : `${titleize(response.level)}: No action was taken.`;
    }

    return `${titleize(response.level)}: ${actions
        .map((action) => `${titleize(action.type)} ${titleize(action.status)}`)
        .join(' | ')}`;
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

function renderDistributionBars(target, items = [], emptyMessage, formatter = (item) => `${item.count}`) {
    if (!target) {
        return;
    }

    if (!items.length) {
        target.innerHTML = `<div class="alert alert-secondary mb-0">${escapeHtml(emptyMessage)}</div>`;
        return;
    }

    target.innerHTML = items.map((item) => {
        const width = Math.max(4, Math.min(100, Number(item.proportion || 0) * 100));
        return `
            <div class="ml-distribution-row">
                <div class="d-flex justify-content-between gap-3 mb-1">
                    <span class="fw-semibold">${escapeHtml(item.label)}</span>
                    <span class="text-muted small">${escapeHtml(formatter(item))}</span>
                </div>
                <progress class="ml-progress ml-distribution-progress" max="100" value="${width.toFixed(1)}">${width.toFixed(1)}%</progress>
            </div>
        `;
    }).join('');
}

function renderFeatureHighlights(target, features = [], emptyMessage, tone) {
    if (!target) {
        return;
    }

    if (!features.length) {
        target.innerHTML = `<div class="alert alert-secondary mb-0">${escapeHtml(emptyMessage)}</div>`;
        return;
    }

    const maxStrength = Math.max(...features.map((feature) => Number(feature.strength) || 0), 1);
    target.innerHTML = features.map((feature) => {
        const width = Math.max(6, ((Number(feature.strength) || 0) / maxStrength) * 100);
        return `
            <div class="ml-feature-card">
                <div class="d-flex justify-content-between gap-3 mb-1">
                    <span class="fw-semibold">${escapeHtml(feature.label)}</span>
                    <span class="small text-muted">${escapeHtml(feature.weight.toFixed(3))}</span>
                </div>
                <progress class="ml-progress tone-${escapeHtml(tone)}" max="100" value="${width.toFixed(1)}">${width.toFixed(1)}%</progress>
            </div>
        `;
    }).join('');
}

function renderAlertTypeBreakdown(items = []) {
    if (!alertTypeBreakdownEl) {
        return;
    }

    if (!items.length) {
        alertTypeBreakdownEl.innerHTML = '<div class="alert alert-secondary mb-0">No alert type priority data is available yet.</div>';
        return;
    }

    alertTypeBreakdownEl.innerHTML = items.map((item) => {
        const total = Number(item.total) || 1;
        return `
            <div class="ml-type-row">
                <div class="d-flex justify-content-between gap-3 mb-1">
                    <span class="fw-semibold">${escapeHtml(item.label)}</span>
                    <span class="text-muted small">${escapeHtml(item.total)} alert(s)</span>
                </div>
                <div class="d-grid gap-2 mb-2" role="img" aria-label="${escapeHtml(item.label)} priority distribution">
                    <div>
                        <div class="d-flex justify-content-between gap-3 small mb-1">
                            <span>High</span>
                            <span>${escapeHtml(item.high || 0)}</span>
                        </div>
                        <progress class="ml-progress tone-high" max="${total}" value="${Number(item.high || 0)}">${escapeHtml(item.high || 0)}</progress>
                    </div>
                    <div>
                        <div class="d-flex justify-content-between gap-3 small mb-1">
                            <span>Medium</span>
                            <span>${escapeHtml(item.medium || 0)}</span>
                        </div>
                        <progress class="ml-progress tone-medium" max="${total}" value="${Number(item.medium || 0)}">${escapeHtml(item.medium || 0)}</progress>
                    </div>
                    <div>
                        <div class="d-flex justify-content-between gap-3 small mb-1">
                            <span>Low</span>
                            <span>${escapeHtml(item.low || 0)}</span>
                        </div>
                        <progress class="ml-progress tone-low" max="${total}" value="${Number(item.low || 0)}">${escapeHtml(item.low || 0)}</progress>
                    </div>
                </div>
                <div class="d-flex flex-wrap gap-2 small text-muted">
                    <span>High ${escapeHtml(item.high || 0)}</span>
                    <span>Medium ${escapeHtml(item.medium || 0)}</span>
                    <span>Low ${escapeHtml(item.low || 0)}</span>
                </div>
            </div>
        `;
    }).join('');
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

function renderAutonomySummary(autonomy = {}) {
    if (!autonomySummaryEl || !autonomyOverviewGrid) {
        return;
    }

    const allowedSources = Array.isArray(autonomy.allowedSources) ? autonomy.allowedSources : [];
    const providers = Array.isArray(autonomy.providers) ? autonomy.providers : [];
    const providerBadges = providers.length > 0
        ? providers.map((provider) => `
            <span class="badge text-bg-${provider.configured ? 'success' : 'secondary'}">${escapeHtml(provider.label)} ${provider.configured ? 'Ready' : 'Off'}</span>
        `).join(' ')
        : '<span class="badge text-bg-secondary">No providers configured</span>';

    autonomySummaryEl.innerHTML = `
        <div class="research-panel">
            <p class="mb-2">
                <strong>${autonomy.enabled ? 'Autonomous response is enabled.' : 'Autonomous response is disabled.'}</strong>
                ${autonomy.enabled
        ? ' Eligible alerts from the configured ingest sources are scored, checked against policy thresholds, and then recorded with any notify or block action outcome.'
        : ' The model may still rank alerts, but no autonomous notify or block policy is being applied.'}
            </p>
            <dl class="automation-metadata mb-3">
                <div><dt>Eligible sources</dt><dd>${escapeHtml(allowedSources.length ? allowedSources.join(', ') : 'None')}</dd></div>
                <div><dt>Notify threshold</dt><dd>${escapeHtml(formatScore(autonomy.notifyThreshold))}</dd></div>
                <div><dt>Block threshold</dt><dd>${escapeHtml(formatScore(autonomy.blockThreshold))}</dd></div>
                <div><dt>Require trained model for block</dt><dd>${autonomy.requireTrainedModelForBlock ? 'Yes' : 'No'}</dd></div>
                <div><dt>Important feedback bypasses notify threshold</dt><dd>${autonomy.notifyOnImportantFeedback ? 'Yes' : 'No'}</dd></div>
            </dl>
            <div class="d-flex flex-wrap gap-2">
                ${providerBadges}
            </div>
        </div>
    `;

    renderMetricCards(
        autonomyOverviewGrid,
        [
            { label: 'Eligible Alerts', count: autonomy.eligibleAlertCount || 0 },
            { label: 'Evaluated Alerts', count: autonomy.evaluatedAlertCount || 0 },
            { label: 'Notify Decisions', count: autonomy.notifyDecisionCount || 0 },
            { label: 'Block Decisions', count: autonomy.blockDecisionCount || 0 }
        ],
        'No autonomous response data is available yet.'
    );
}

function renderRecentAlerts(alerts = []) {
    if (!recentAlertsGrid) {
        return;
    }

    if (!alerts.length) {
        recentAlertsGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No alerts are available yet. Analyze logs in the Security Operations Module first, then label a few alerts and return here.</div>
            </div>
        `;
        return;
    }

    recentAlertsGrid.innerHTML = alerts.map((alert) => {
        const reasons = Array.isArray(alert.mlReasons) ? alert.mlReasons.slice(0, 3) : [];
        const responseSummary = formatResponseSummary(alert.response || {});

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
                        <p class="small mb-1"><strong>Autonomous response:</strong> ${escapeHtml(responseSummary)}</p>
                        <p class="small text-muted mb-2"><strong>Feedback:</strong> ${escapeHtml(titleize(alert.feedback && alert.feedback.label ? alert.feedback.label : 'unreviewed'))} &middot; ${escapeHtml(alert.scoreSource || 'heuristic-baseline')}</p>
                        <div class="small text-muted">
                            ${reasons.length ? reasons.map((reason) => `<div>&rsaquo; ${escapeHtml(reason)}</div>`).join('') : 'No model rationale available yet.'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function requestJson(url, options = {}, fallbackMessage) {
    try {
        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options
        });
        const contentType = response.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            const unexpectedBody = await response.text();
            if (response.status === 401 || response.status === 403) {
                throw new Error('Your session is no longer active. Refresh the page and sign in again.');
            }

            throw new Error(
                unexpectedBody && unexpectedBody.trim()
                    ? 'The server returned an unexpected response. Refresh the page and try again.'
                    : (fallbackMessage || 'The request could not be completed.')
            );
        }

        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || fallbackMessage || 'The request could not be completed.');
        }

        return payload;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Could not reach the server. Refresh the page and confirm the app is still running on localhost:3000.');
        }

        throw error;
    }
}

async function fetchOverview() {
    const payload = await requestJson(overviewEndpoint, {
        headers: {
            Accept: 'application/json'
        }
    }, 'Unable to load the Alert Triage ML module overview.');

    return payload.data;
}

function renderOverview(data) {
    renderModelSummary(data.model || {});
    renderAutonomySummary(data.autonomy || {});
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
    renderDistributionBars(
        scoreBucketsGrid,
        data.alerts && Array.isArray(data.alerts.scoreBuckets) ? data.alerts.scoreBuckets : [],
        'No score bucket distribution is available yet.',
        (item) => `${item.count} alert(s)`
    );
    renderDistributionBars(
        responseLevelGrid,
        data.autonomy && Array.isArray(data.autonomy.levelCounts) ? data.autonomy.levelCounts : [],
        'No eligible autonomous-response records are available yet.',
        (item) => `${item.count} alert(s)`
    );
    renderDistributionBars(
        responseActionGrid,
        data.autonomy && Array.isArray(data.autonomy.actionStatusCounts) ? data.autonomy.actionStatusCounts : [],
        'No autonomous action attempts have been recorded yet.',
        (item) => `${item.count} action(s)`
    );
    renderAlertTypeBreakdown(
        data.alerts && Array.isArray(data.alerts.typePriorityBreakdown) ? data.alerts.typePriorityBreakdown : []
    );
    renderFeatureHighlights(
        positiveFeaturesEl,
        data.model && Array.isArray(data.model.topPositiveFeatures) ? data.model.topPositiveFeatures : [],
        'Train a model to see which learned features push scores upward.',
        'positive'
    );
    renderFeatureHighlights(
        negativeFeaturesEl,
        data.model && Array.isArray(data.model.topNegativeFeatures) ? data.model.topNegativeFeatures : [],
        'Train a model to see which learned features suppress scores.',
        'negative'
    );
    renderRecentAlerts(data.alerts && Array.isArray(data.alerts.recentAlerts) ? data.alerts.recentAlerts : []);
}

async function trainModel(mode) {
    const payload = await requestJson(trainEndpoint, {
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
    }, `Unable to train the ${mode === 'bootstrap' ? 'bootstrap' : 'hybrid'} model.`);

    return payload.data;
}

async function injectAutonomyDemo() {
    const payload = await requestJson(autonomyDemoEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            Accept: 'application/json'
        },
        body: JSON.stringify({})
    }, 'Unable to inject the autonomy demo.');

    return payload.data;
}

async function refreshModule(showMessage = false) {
    const overview = await fetchOverview();
    renderOverview(overview);
    if (showMessage) {
        renderStatus('Alert Triage ML module refreshed.', 'secondary');
    }
}

async function handleTraining(mode) {
    const label = mode === 'bootstrap' ? 'bootstrap' : 'hybrid';
    renderStatus(`Training the ${label} model. This may take a moment...`, 'info');
    setTrainingButtonsDisabled(true);

    try {
        const result = await trainModel(mode);
        await refreshModule(false);
        renderStatus(`Finished training the ${label} model with ${result.model.trainingSamples} sample(s). Rescored ${result.rescoredAlerts} stored alert(s).`, 'success');
    } catch (error) {
        renderStatus(error.message || `Unable to train the ${label} model right now.`, 'danger');
    } finally {
        setTrainingButtonsDisabled(false);
    }
}

async function initializeMlModule() {
    try {
        await refreshModule(false);
        renderStatus('Alert Triage ML module ready. You can inspect the current model or train a new one from this page.', 'secondary');
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Alert Triage ML module.', 'danger');
    }
}

async function handleAutonomyDemo() {
    renderStatus('Injecting a dry-run autonomy demo and refreshing the module...', 'info');
    setTrainingButtonsDisabled(true);

    try {
        const result = await injectAutonomyDemo();
        await refreshModule(false);
        renderStatus(
            `Injected ${result.createdAlerts} autonomy demo alert(s) in dry-run mode. Notify decisions: ${result.levelCounts.notify || 0}. Block decisions: ${result.levelCounts.block || 0}.`,
            'success'
        );
    } catch (error) {
        renderStatus(error.message || 'Unable to inject the autonomy demo right now.', 'danger');
    } finally {
        setTrainingButtonsDisabled(false);
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        refreshModule(true).catch((error) => {
            renderStatus(error.message || 'Unable to refresh the Alert Triage ML module.', 'danger');
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

if (autonomyDemoBtn) {
    autonomyDemoBtn.addEventListener('click', () => {
        handleAutonomyDemo();
    });
}

initializeMlModule();
