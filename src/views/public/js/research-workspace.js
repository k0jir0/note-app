const csrfToken = window.getCsrfToken();

const SAMPLE_LOG_TEXT = [
    '2026-03-12 10:14:01 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:04 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:07 192.168.1.10 POST /auth/login 403',
    '2026-03-12 10:14:10 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:13 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:16 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:20 10.0.0.45 GET /.env 404 Nikto/2.1.6',
    '2026-03-12 10:14:21 10.0.0.45 GET /wp-admin 404 Nikto/2.1.6',
    '2026-03-12 10:14:22 10.0.0.45 GET /phpmyadmin 404 Nikto/2.1.6',
    '2026-03-12 10:14:23 10.0.0.45 GET /.git/config 404 Nikto/2.1.6',
    '2026-03-12 10:14:24 10.0.0.45 GET /etc/passwd 404 Nikto/2.1.6',
    '2026-03-12 10:14:25 10.0.0.45 GET /xmlrpc.php 404 Nikto/2.1.6',
    '2026-03-12 10:14:26 10.0.0.45 GET /cgi-bin/test.cgi 404 Nikto/2.1.6',
    '2026-03-12 10:14:27 10.0.0.45 GET /backup.zip 404 Nikto/2.1.6',
    '2026-03-12 10:14:28 10.0.0.45 GET /.htaccess 404 Nikto/2.1.6',
    '2026-03-12 10:14:29 10.0.0.45 GET /admin 404 Nikto/2.1.6'
].join('\n');

const SAMPLE_SCAN_TEXT = `- Nikto v2.1.6
---------------------------------------------------------------------------
+ Target IP:          10.10.10.50
+ Target Hostname:    target.local
+ Target Port:        80
---------------------------------------------------------------------------
+ Server: Apache/2.4.41 (Ubuntu)
+ /admin/: Admin directory found. Directory indexing may be enabled.
+ OSVDB-3233: /icons/README: Apache default file found. This can expose server information.
+ OSVDB-3268: /phpmyadmin/: phpMyAdmin found. This is insecure if accessible publicly.
+ OSVDB-397: HTTP method 'PUT' allows clients to save files on the web server.
+ /login.php?action=backup: phpMyAdmin-type backup file found. Should be deleted.
+ OSVDB-3092: /.htaccess: .htaccess file retrieved. May expose internal configuration.
+ /config.php: Configuration file found exposed in web root. May contain credentials.
+ /cgi-bin/test.cgi: CGI script found. Potential code execution risk.
+ X-Powered-By header leaks technology: PHP/7.4.3
---------------------------------------------------------------------------`;

const workspaceStatus = document.getElementById('workspace-status');
const logForm = document.getElementById('workspace-log-form');
const logTextInput = document.getElementById('workspace-log-text');
const scanForm = document.getElementById('workspace-scan-form');
const scanTextInput = document.getElementById('workspace-scan-text');
const alertCountEl = document.getElementById('workspace-alert-count');
const scanCountEl = document.getElementById('workspace-scan-count');
const correlationCountEl = document.getElementById('workspace-correlation-count');
const alertsGrid = document.getElementById('workspace-alerts-grid');
const scansGrid = document.getElementById('workspace-scans-grid');
const correlationGrid = document.getElementById('workspace-correlations-grid');
const correlationOverview = document.getElementById('workspace-correlation-overview');
const automationSampleResult = document.getElementById('automation-sample-result');
const ALERT_FEEDBACK_BUTTONS = [
    { value: 'important', label: 'Important', variant: 'success' },
    { value: 'needs_review', label: 'Needs Review', variant: 'warning' },
    { value: 'false_positive', label: 'False Positive', variant: 'secondary' },
    { value: 'resolved', label: 'Resolved', variant: 'primary' },
    { value: 'unreviewed', label: 'Reset', variant: 'dark' }
];

const resolveCount = (preferredCount, fallbackItems = []) => {
    const normalized = Number(preferredCount);
    if (Number.isFinite(normalized) && normalized >= 0) {
        return normalized;
    }

    return Array.isArray(fallbackItems) ? fallbackItems.length : 0;
};

const escapeHtml = (value = '') => {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
};

const formatAlertFeedback = (feedback = {}) => {
    const label = String(feedback.label || 'unreviewed').replaceAll('_', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatAlertScore = (value) => {
    const score = Number(value);
    return Number.isFinite(score) ? score.toFixed(2) : '0.00';
};

const titleizeValue = (value = '') => {
    const normalized = String(value).replaceAll('_', ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatResponseSummary = (response = {}) => {
    if (!response || typeof response !== 'object' || !response.level) {
        return 'No autonomous response recorded yet.';
    }

    const levelLabel = titleizeValue(response.level);
    const actions = Array.isArray(response.actions) ? response.actions : [];

    if (!actions.length) {
        return response.reason
            ? `${levelLabel}: ${String(response.reason)}`
            : `${levelLabel}: No action was taken.`;
    }

    const actionSummary = actions
        .map((action) => `${titleizeValue(action.type)} ${titleizeValue(action.status)}`)
        .join(' | ');

    return `${levelLabel}: ${actionSummary}`;
};

const renderMessage = (elementId, message, type = 'secondary') => {
    const target = document.getElementById(elementId);
    if (!target) {
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${escapeHtml(type)} mb-0`;
    alert.textContent = String(message);
    target.replaceChildren(alert);
};

const renderWorkspaceStatus = (message, type = 'secondary') => {
    if (!workspaceStatus) {
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${escapeHtml(type)} mb-0`;
    alert.textContent = String(message);
    workspaceStatus.replaceChildren(alert);
};

const renderAutomationResult = (message, type = 'secondary') => {
    if (!automationSampleResult) {
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${escapeHtml(type)} mb-0`;
    alert.textContent = String(message);
    automationSampleResult.replaceChildren(alert);
};

const formatAutomationSampleResult = (payloadData = {}) => {
    const createdAlerts = Number(payloadData.createdAlerts || 0);
    const skippedAlerts = Number(payloadData.skippedAlerts || 0);
    const findingsCount = Number(payloadData.findingsCount || 0);
    const scanCreated = Boolean(payloadData.scanCreated);
    const scanSkippedReason = payloadData.scanSkippedReason;

    if (createdAlerts === 0 && !scanCreated) {
        const duplicateNote = scanSkippedReason === 'duplicate'
            ? 'The sample scan was already imported earlier.'
            : 'No new scan record was created.';
        return `No new demo records were created. ${duplicateNote} ${skippedAlerts > 0 ? `${skippedAlerts} alert pattern(s) were also skipped as existing records.` : ''}`.trim();
    }

    return `Created ${createdAlerts} alert(s) and ${scanCreated ? `1 scan with ${findingsCount} finding(s)` : 'no new scan'} from the automation demo sample.`;
};

const renderAlerts = (alerts = [], totalCount = alerts.length) => {
    if (!alertsGrid) {
        return;
    }

    alertCountEl.textContent = String(resolveCount(totalCount, alerts));

    if (!alerts.length) {
        alertsGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No alerts yet. Analyze logs or inject demo security data from this page.</div>
            </div>
        `;
        return;
    }

    alertsGrid.innerHTML = alerts.map((alert) => {
        const severity = escapeHtml(alert.severity || 'low');
        const summary = escapeHtml(alert.summary || 'Security event detected');
        const type = escapeHtml(alert.type || 'unknown');
        const detectedAt = alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'Unknown time';
        const feedbackLabel = formatAlertFeedback(alert.feedback || {});
        const scoreLabel = escapeHtml(alert.mlLabel || 'low');
        const scoreValue = formatAlertScore(alert.mlScore);
        const scoreSource = escapeHtml(alert.scoreSource || 'heuristic-baseline');
        const responseSummary = formatResponseSummary(alert.response || {});
        const triageReasons = Array.isArray(alert.mlReasons) ? alert.mlReasons.slice(0, 2) : [];
        const triageReasonHtml = triageReasons.length > 0
            ? `<div class="small text-muted mb-2">${triageReasons.map((reason) => escapeHtml(reason)).join(' · ')}</div>`
            : '';
        const feedbackButtons = ALERT_FEEDBACK_BUTTONS.map((button) => {
            const isActive = (alert.feedback && alert.feedback.label) === button.value;
            const buttonClass = isActive
                ? `btn btn-sm btn-${button.variant}`
                : `btn btn-sm btn-outline-${button.variant}`;
            return `
                <button
                    type="button"
                    class="${buttonClass}"
                    data-alert-feedback="${escapeHtml(button.value)}"
                    data-alert-id="${escapeHtml(alert._id)}">
                    ${escapeHtml(button.label)}
                </button>
            `;
        }).join('');

        return `
            <div class="col-md-6 mb-3">
                <div class="card h-100 security-alert-card severity-${severity}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge text-bg-light text-uppercase">${severity}</span>
                            <small class="text-muted">${escapeHtml(detectedAt)}</small>
                        </div>
                        <h3 class="h6 mb-2">${summary}</h3>
                        <p class="text-muted small mb-1">Type: ${type}</p>
                        <p class="small mb-1"><strong>Triage score:</strong> ${escapeHtml(scoreValue)} (${scoreLabel})</p>
                        <p class="small mb-1"><strong>Autonomous response:</strong> ${escapeHtml(responseSummary)}</p>
                        <p class="small text-muted mb-2"><strong>Analyst state:</strong> ${escapeHtml(feedbackLabel)} · ${scoreSource}</p>
                        ${triageReasonHtml}
                        <div class="d-flex flex-wrap gap-2">
                            ${feedbackButtons}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const renderScans = (scans = [], totalCount = scans.length) => {
    if (!scansGrid) {
        return;
    }

    scanCountEl.textContent = String(resolveCount(totalCount, scans));

    if (!scans.length) {
        scansGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No scans yet. Import one manually or inject demo security data from this page.</div>
            </div>
        `;
        return;
    }

    scansGrid.innerHTML = scans.map((scan) => {
        const findings = Array.isArray(scan.findings) ? scan.findings : [];
        const highCount = findings.filter((finding) => finding.severity === 'high').length;
        const medCount = findings.filter((finding) => finding.severity === 'medium').length;
        const lowCount = findings.filter((finding) => finding.severity === 'low').length;
        const topSeverity = highCount > 0 ? 'high' : (medCount > 0 ? 'medium' : 'low');
        const badgesHtml = [
            highCount > 0 ? `<span class="badge findings-badge-high">${highCount} high</span>` : '',
            medCount > 0 ? `<span class="badge findings-badge-medium">${medCount} medium</span>` : '',
            lowCount > 0 ? `<span class="badge findings-badge-low">${lowCount} low</span>` : ''
        ].filter(Boolean).join(' ');
        const findingsList = findings.slice(0, 3)
            .map((finding) => `<li class="text-truncate">&rsaquo; ${escapeHtml(finding.title)}</li>`)
            .join('');

        return `
            <div class="col-md-6 mb-3">
                <div class="card h-100 scan-result-card severity-${escapeHtml(topSeverity)}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge text-bg-dark text-uppercase me-1">${escapeHtml(scan.tool || 'unknown')}</span>
                                <span class="badge text-bg-light text-uppercase">${escapeHtml(topSeverity)}</span>
                            </div>
                            <small class="text-muted">${escapeHtml(scan.importedAt ? new Date(scan.importedAt).toLocaleString() : 'Unknown time')}</small>
                        </div>
                        <h3 class="h6 mb-2">Target: <strong>${escapeHtml(scan.target || 'unknown')}</strong></h3>
                        <div class="d-flex gap-2 mb-2">${badgesHtml || '<span class="text-muted small">No findings</span>'}</div>
                        <ul class="list-unstyled small text-muted mb-0">${findingsList}</ul>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const renderCorrelationOverview = (overview = {}) => {
    if (!correlationOverview) {
        return;
    }

    const totalCount = resolveCount(overview.total);
    const highPriorityCount = resolveCount(overview.highPriority);
    const targetCount = resolveCount(overview.targets);

    correlationCountEl.textContent = String(totalCount);
    correlationOverview.innerHTML = `
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Correlation Matches</p>
                    <p class="display-6 mb-0">${escapeHtml(totalCount)}</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">High Priority</p>
                    <p class="display-6 mb-0">${escapeHtml(highPriorityCount)}</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Distinct Targets</p>
                    <p class="display-6 mb-0">${escapeHtml(targetCount)}</p>
                </div>
            </div>
        </div>
    `;
};

const renderCorrelations = (correlations = []) => {
    if (!correlationGrid) {
        return;
    }

    if (!correlations.length) {
        correlationGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No correlations yet. Add alerts and scans to see prioritized matches.</div>
            </div>
        `;
        return;
    }

    correlationGrid.innerHTML = correlations.map((correlation) => {
        const rationale = (correlation.rationale || [])
            .map((reason) => `<div class="correlation-reason">&rsaquo; ${escapeHtml(reason)}</div>`)
            .join('');
        const topFindings = (correlation.scan && correlation.scan.topFindings ? correlation.scan.topFindings : [])
            .slice(0, 3)
            .map((finding) => `<li>&rsaquo; ${escapeHtml(finding.title)} (${escapeHtml(finding.severity)})</li>`)
            .join('');

        return `
            <div class="col-lg-6 mb-3">
                <div class="card h-100 correlation-card severity-${escapeHtml(correlation.severity || 'low')}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge text-bg-light text-uppercase me-1">${escapeHtml(correlation.severity || 'low')}</span>
                                <span class="badge text-bg-dark text-uppercase">${escapeHtml(correlation.scan && correlation.scan.tool ? correlation.scan.tool : 'unknown')}</span>
                            </div>
                            <small class="text-muted">${escapeHtml(correlation.alert && correlation.alert.detectedAt ? new Date(correlation.alert.detectedAt).toLocaleString() : 'Unknown time')}</small>
                        </div>
                        <h3 class="h6 mb-2">${escapeHtml(correlation.headline || 'Correlation detected')}</h3>
                        <p class="text-muted small mb-2">Target: <strong>${escapeHtml(correlation.target || 'unknown')}</strong></p>
                        <div class="mb-3">
                            <p class="small fw-semibold mb-2">Why the app links these:</p>
                            ${rationale}
                        </div>
                        <p class="small mb-1"><strong>Alert:</strong> ${escapeHtml(correlation.alert && correlation.alert.summary ? correlation.alert.summary : '')}</p>
                        <p class="small text-muted mb-2"><strong>Scan:</strong> ${escapeHtml(correlation.scan && correlation.scan.summary ? correlation.scan.summary : '')}</p>
                        <ul class="list-unstyled small text-muted mb-0">${topFindings}</ul>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const renderAlertsPayload = (payload = {}) => {
    renderAlerts(payload.data || [], payload.totalCount || payload.count || 0);
};

const renderScansPayload = (payload = {}) => {
    renderScans(payload.data || [], payload.totalCount || payload.count || 0);
};

const renderCorrelationsPayload = (payload = {}) => {
    renderCorrelationOverview(payload.overview || {});
    renderCorrelations(payload.data || []);
};

const fetchAlerts = async () => {
    const response = await fetch('/api/security/alerts?limit=6&sort=ml_score', {
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh alerts');
    }

    return response.json();
};

const updateAlertFeedback = async (alertId, feedbackLabel) => {
    const response = await fetch(`/api/security/alerts/${encodeURIComponent(alertId)}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ feedbackLabel })
    });
    const payload = await response.json();

    if (!response.ok) {
        const message = payload.errors && payload.errors.length > 0
            ? payload.errors.join(', ')
            : 'Unable to update alert feedback.';
        throw new Error(message);
    }

    return payload;
};

const fetchScans = async () => {
    const response = await fetch('/api/security/scans?limit=6', {
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh scans');
    }

    return response.json();
};

const fetchCorrelations = async () => {
    const response = await fetch('/api/security/correlations?limit=6', {
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh correlations');
    }

    return response.json();
};

const refreshAlertsPanel = async () => {
    const payload = await fetchAlerts();
    renderAlertsPayload(payload);
    return payload;
};

const refreshScansPanel = async () => {
    const payload = await fetchScans();
    renderScansPayload(payload);
    return payload;
};

const refreshCorrelationPanels = async () => {
    const payload = await fetchCorrelations();
    renderCorrelationsPayload(payload);
    return payload;
};

const createRefreshTasks = ({ alerts = true, scans = true, correlations = true } = {}) => {
    const tasks = [];

    if (alerts) {
        tasks.push(refreshAlertsPanel());
    }

    if (scans) {
        tasks.push(refreshScansPanel());
    }

    if (correlations) {
        tasks.push(refreshCorrelationPanels());
    }

    return tasks;
};

const refreshWorkspace = async (options = {}) => {
    await Promise.all(createRefreshTasks(options));
};

const refreshWorkspaceSettled = async (options = {}) => {
    return Promise.allSettled(createRefreshTasks(options));
};

const hasRefreshFailures = (results = []) => {
    return results.some((result) => result.status === 'rejected');
};

document.getElementById('workspace-refresh-all')?.addEventListener('click', async () => {
    try {
        renderWorkspaceStatus('Refreshing workspace...', 'info');
        await refreshWorkspace();
        renderWorkspaceStatus('Workspace refreshed.', 'success');
    } catch (_error) {
        renderWorkspaceStatus('Unable to refresh the workspace right now.', 'danger');
    }
});

document.getElementById('workspace-refresh-alerts')?.addEventListener('click', async () => {
    try {
        await refreshAlertsPanel();
        renderWorkspaceStatus('Alerts refreshed.', 'success');
    } catch (_error) {
        renderWorkspaceStatus('Unable to refresh alerts right now.', 'danger');
    }
});

alertsGrid?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-alert-feedback][data-alert-id]');
    if (!button) {
        return;
    }

    const alertId = button.getAttribute('data-alert-id');
    const feedbackLabel = button.getAttribute('data-alert-feedback');
    if (!alertId || !feedbackLabel) {
        return;
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving...';

    try {
        const payload = await updateAlertFeedback(alertId, feedbackLabel);
        await refreshAlertsPanel();
        renderWorkspaceStatus(
            `Alert feedback updated: ${formatAlertFeedback(payload.data && payload.data.feedback ? payload.data.feedback : { label: feedbackLabel })}.`,
            'success'
        );
    } catch (error) {
        renderWorkspaceStatus(error.message || 'Unable to update alert feedback right now.', 'danger');
    } finally {
        button.disabled = false;
        button.textContent = previousText;
    }
});

document.getElementById('workspace-refresh-scans')?.addEventListener('click', async () => {
    try {
        await refreshScansPanel();
        renderWorkspaceStatus('Scans refreshed.', 'success');
    } catch (_error) {
        renderWorkspaceStatus('Unable to refresh scans right now.', 'danger');
    }
});

document.getElementById('workspace-refresh-correlations')?.addEventListener('click', async () => {
    try {
        await refreshCorrelationPanels();
        renderMessage('workspace-correlation-result', 'Correlations refreshed.', 'success');
    } catch (_error) {
        renderMessage('workspace-correlation-result', 'Unable to refresh correlations right now.', 'danger');
    }
});

document.getElementById('workspace-inject-correlation-demo')?.addEventListener('click', async () => {
    try {
        renderMessage('workspace-correlation-result', 'Injecting 3-target correlation demo and refreshing saved results...', 'info');

        const response = await fetch('/api/security/correlations/sample', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: '{}'
        });
        const payload = await response.json();

        if (!response.ok) {
            const message = payload.errors && payload.errors.length > 0
                ? payload.errors.join(', ')
                : 'Unable to inject correlation demo right now.';
            renderMessage('workspace-correlation-result', message, 'danger');
            return;
        }

        const refreshResults = await Promise.allSettled([
            refreshAlertsPanel(),
            refreshScansPanel()
        ]);
        renderCorrelationsPayload(payload);

        const targetCount = payload.overview ? payload.overview.targets : 0;
        const createdScans = payload.meta ? payload.meta.createdScans : 0;
        const createdAlerts = payload.meta ? payload.meta.createdAlerts : 0;
        const successMessage = `Injected ${createdScans} demo scans and ${createdAlerts} demo alerts across ${targetCount} distinct targets. Correlation View has been refreshed with the saved results.`;

        if (hasRefreshFailures(refreshResults)) {
            renderMessage('workspace-correlation-result', `${successMessage} Alerts or scans may need a manual refresh.`, 'warning');
            return;
        }

        renderMessage('workspace-correlation-result', successMessage, 'success');
    } catch (_error) {
        renderMessage('workspace-correlation-result', 'Unexpected error while injecting the correlation demo.', 'danger');
    }
});

document.getElementById('workspace-load-sample-log')?.addEventListener('click', () => {
    logTextInput.value = SAMPLE_LOG_TEXT;
    renderMessage('workspace-log-result', 'Sample log loaded. Click Analyze Logs to save alerts.', 'info');
});

document.getElementById('workspace-load-sample-scan')?.addEventListener('click', () => {
    scanTextInput.value = SAMPLE_SCAN_TEXT;
    renderMessage('workspace-scan-result', 'Sample scan loaded. Click Import Scan to save findings.', 'info');
});

document.getElementById('automation-inject-sample')?.addEventListener('click', async () => {
    try {
        renderWorkspaceStatus('Injecting automation sample...', 'info');
        renderAutomationResult('Injecting automation sample and refreshing the module...', 'info');

        const response = await fetch('/api/security/automation/sample', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: '{}'
        });
        const payload = await response.json();

        if (!response.ok) {
            const message = payload.errors && payload.errors.length > 0
                ? payload.errors.join(', ')
                : 'Unable to inject automation sample right now.';
            renderWorkspaceStatus(message, 'danger');
            renderAutomationResult(message, 'danger');
            return;
        }

        const refreshResults = await refreshWorkspaceSettled();
        if (hasRefreshFailures(refreshResults)) {
            renderWorkspaceStatus('Automation sample completed, but some panels need a manual refresh.', 'warning');
        } else {
            renderWorkspaceStatus('Automation sample completed and the module was refreshed.', 'success');
        }

        renderAutomationResult(formatAutomationSampleResult(payload.data || {}), 'success');
    } catch (_error) {
        renderWorkspaceStatus('Unexpected error while injecting automation sample.', 'danger');
        renderAutomationResult('Unexpected error while injecting automation sample.', 'danger');
    }
});

logForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        renderMessage('workspace-log-result', 'Analyzing logs...', 'info');

        const response = await fetch('/api/security/log-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ logText: logTextInput.value })
        });
        const payload = await response.json();

        if (!response.ok) {
            const message = payload.errors && payload.errors.length > 0
                ? payload.errors.join(', ')
                : 'Unable to analyze logs';
            renderMessage('workspace-log-result', message, 'danger');
            return;
        }

        const refreshResults = await refreshWorkspaceSettled({
            alerts: true,
            scans: false,
            correlations: true
        });
        const resultMessage = `${payload.data.createdAlerts} alert(s) created from ${payload.data.linesAnalyzed} lines.`;

        if (hasRefreshFailures(refreshResults)) {
            renderMessage('workspace-log-result', `${resultMessage} Correlation panels may need a manual refresh.`, 'warning');
            return;
        }

        renderMessage('workspace-log-result', resultMessage, 'success');
    } catch (_error) {
        renderMessage('workspace-log-result', 'Unexpected error while analyzing logs.', 'danger');
    }
});

scanForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        renderMessage('workspace-scan-result', 'Importing scan...', 'info');

        const response = await fetch('/api/security/scan-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ rawInput: scanTextInput.value })
        });
        const payload = await response.json();

        if (!response.ok) {
            const message = payload.errors && payload.errors.length > 0
                ? payload.errors.join(', ')
                : 'Unable to import scan';
            renderMessage('workspace-scan-result', message, 'danger');
            return;
        }

        const refreshResults = await refreshWorkspaceSettled({
            alerts: false,
            scans: true,
            correlations: true
        });
        const resultMessage = `Scan imported with ${payload.data.findingsCount} finding(s).`;

        if (hasRefreshFailures(refreshResults)) {
            renderMessage('workspace-scan-result', `${resultMessage} Correlation panels may need a manual refresh.`, 'warning');
            return;
        }

        renderMessage('workspace-scan-result', resultMessage, 'success');
    } catch (_error) {
        renderMessage('workspace-scan-result', 'Unexpected error while importing the scan.', 'danger');
    }
});

refreshWorkspace()
    .then(() => {
        renderWorkspaceStatus('Workspace loaded.', 'secondary');
    })
    .catch(() => {
        renderWorkspaceStatus('Workspace loaded with partial data. Use the refresh controls to retry.', 'warning');
    });

window.securityWorkspace = {
    csrfToken,
    refreshWorkspace,
    refreshAlertsPanel,
    refreshScansPanel,
    refreshCorrelationPanels,
    renderWorkspaceStatus
};
