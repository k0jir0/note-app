const correlationsGrid = document.getElementById('correlations-grid');
const overviewContainer = document.getElementById('correlation-overview');
const resultBox = document.getElementById('correlation-result');
const refreshButton = document.getElementById('refresh-correlations');
const injectSampleButton = document.getElementById('inject-sample-correlations');
const clearButton = document.getElementById('clear-correlations');
const csrfToken = window.getCsrfToken();

const escapeHtml = (value = '') => {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
};

const renderMessage = (message, type = 'secondary') => {
    if (!resultBox) {
        return;
    }

    resultBox.innerHTML = `<div class="alert alert-${escapeHtml(type)} mb-0">${message}</div>`;
};

const renderOverview = (overview = {}) => {
    if (!overviewContainer) {
        return;
    }

    overviewContainer.innerHTML = `
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Correlation Matches</p>
                    <p class="display-6 mb-0">${escapeHtml(overview.total || 0)}</p>
                    <p class="small text-muted mb-0">How many scan findings and security alerts appear to describe the same issue.</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">High Priority</p>
                    <p class="display-6 mb-0">${escapeHtml(overview.highPriority || 0)}</p>
                    <p class="small text-muted mb-0">How many of those matches look serious and should be reviewed first.</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Distinct Targets</p>
                    <p class="display-6 mb-0">${escapeHtml(overview.targets || 0)}</p>
                    <p class="small text-muted mb-0">How many different systems or hosts are involved in the matches shown below.</p>
                </div>
            </div>
        </div>
    `;
};

const renderCorrelations = (correlations = []) => {
    if (!correlationsGrid) {
        return;
    }

    if (!correlations.length) {
        correlationsGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No recent correlations yet. Inject sample logs to draw example matches here.</div>
            </div>
        `;
        return;
    }

    correlationsGrid.innerHTML = correlations.map((correlation) => {
        const rationale = (correlation.rationale || [])
            .map((reason) => `<div class="correlation-reason">&rsaquo; ${escapeHtml(reason)}</div>`)
            .join('');

        const chips = [
            correlation.matchedIndicators && correlation.matchedIndicators.ips && correlation.matchedIndicators.ips.length > 0
                ? `<span class="badge correlation-chip">IPs: ${escapeHtml(correlation.matchedIndicators.ips.join(', '))}</span>`
                : '',
            correlation.matchedIndicators && correlation.matchedIndicators.tools && correlation.matchedIndicators.tools.length > 0
                ? `<span class="badge correlation-chip">Tools: ${escapeHtml(correlation.matchedIndicators.tools.join(', '))}</span>`
                : '',
            correlation.matchedIndicators && correlation.matchedIndicators.webFindingCount > 0
                ? `<span class="badge correlation-chip">${escapeHtml(correlation.matchedIndicators.webFindingCount)} web finding(s)</span>`
                : '',
            correlation.matchedIndicators && correlation.matchedIndicators.authFindingCount > 0
                ? `<span class="badge correlation-chip">${escapeHtml(correlation.matchedIndicators.authFindingCount)} auth finding(s)</span>`
                : ''
        ].filter(Boolean).join('');

        const topFindings = (correlation.scan && correlation.scan.topFindings ? correlation.scan.topFindings : [])
            .map((finding) => `<li>&rsaquo; ${escapeHtml(finding.title)} (${escapeHtml(finding.severity)})</li>`)
            .join('');

        const timestamp = correlation.alert && correlation.alert.detectedAt
            ? new Date(correlation.alert.detectedAt).toLocaleString()
            : 'Unknown time';

        return `
            <div class="col-lg-6 mb-3">
                <div class="card h-100 correlation-card severity-${escapeHtml(correlation.severity || 'low')}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge text-bg-light text-uppercase me-1">${escapeHtml(correlation.severity || 'low')}</span>
                                <span class="badge text-bg-dark text-uppercase">${escapeHtml(correlation.scan && correlation.scan.tool ? correlation.scan.tool : 'unknown')}</span>
                            </div>
                            <small class="text-muted">${escapeHtml(timestamp)}</small>
                        </div>
                        <h3 class="h6 mb-2">${escapeHtml(correlation.headline || 'Correlation detected')}</h3>
                        <p class="text-muted small mb-2">Target: <strong>${escapeHtml(correlation.target || 'unknown')}</strong></p>
                        <div class="mb-3">
                            <p class="small fw-semibold mb-2">Why the app thinks these belong together:</p>
                            ${rationale}
                        </div>
                        <div class="d-flex flex-wrap gap-2 mb-3">${chips}</div>
                        <p class="small text-muted mb-1">This card combines one alert with one scan result that likely describe the same risk.</p>
                        <p class="small text-muted mb-1">The lines below are concise examples of what was detected, not full log dumps.</p>
                        <p class="small mb-1"><strong>Alert:</strong> ${escapeHtml(correlation.alert && correlation.alert.summary ? correlation.alert.summary : '')}</p>
                        <p class="small text-muted mb-2"><strong>Scan:</strong> ${escapeHtml(correlation.scan && correlation.scan.summary ? correlation.scan.summary : '')}</p>
                        <p class="small fw-semibold mb-1">Top scan findings behind this match:</p>
                        <ul class="list-unstyled small text-muted mb-0">${topFindings}</ul>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const refreshCorrelations = async () => {
    const response = await fetch('/api/security/correlations?limit=20', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh correlations');
    }

    const payload = await response.json();
    renderOverview(payload.overview || {});
    renderCorrelations(payload.data || []);
};

const injectSampleCorrelations = async () => {
    const response = await fetch('/api/security/correlations/sample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        }
    });

    if (!response.ok) {
        throw new Error('Unable to inject sample correlations');
    }

    const payload = await response.json();
    renderOverview(payload.overview || {});
    renderCorrelations(payload.data || []);
    return payload;
};

const clearCorrelations = () => {
    renderOverview({ total: 0, highPriority: 0, targets: 0 });
    renderCorrelations([]);
    renderMessage('Correlation view cleared.', 'secondary');
};

if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
        try {
            renderMessage('Refreshing correlations...', 'info');
            await refreshCorrelations();
            renderMessage('Correlation view updated.', 'success');
        } catch (_error) {
            renderMessage('Unable to refresh correlations right now.', 'danger');
        }
    });
}

if (injectSampleButton) {
    injectSampleButton.addEventListener('click', async () => {
        try {
            renderMessage('Injecting sample log and scan data...', 'info');
            await injectSampleCorrelations();
            renderMessage('Sample data injected. Example correlations are now shown below.', 'success');
        } catch (_error) {
            renderMessage('Unable to inject sample data right now.', 'danger');
        }
    });
}

if (clearButton) {
    clearButton.addEventListener('click', () => {
        clearCorrelations();
    });
}

clearCorrelations();
