const form = document.getElementById('log-analysis-form');
const resultBox = document.getElementById('analysis-result');
const logTextInput = document.getElementById('logText');
const injectFakeLogButton = document.getElementById('inject-fake-log');
const alertsGrid = document.getElementById('alerts-grid');

const SAMPLE_LOG_TEXT = [
    // Failed login burst — 6 attempts from 192.168.1.10 (threshold: 5)
    '2026-03-12 10:14:01 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:04 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:07 192.168.1.10 POST /auth/login 403',
    '2026-03-12 10:14:10 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:13 192.168.1.10 POST /auth/login 401',
    '2026-03-12 10:14:16 192.168.1.10 POST /auth/login 401',
    // Path probing + scanner UA (Nikto) — 10 requests, triggers both detectors
    '2026-03-12 10:14:20 10.0.0.45 GET /.env 404 Nikto/2.1.6',
    '2026-03-12 10:14:21 10.0.0.45 GET /wp-admin 404 Nikto/2.1.6',
    '2026-03-12 10:14:22 10.0.0.45 GET /phpmyadmin 404 Nikto/2.1.6',
    '2026-03-12 10:14:23 10.0.0.45 GET /.git/config 404 Nikto/2.1.6',
    '2026-03-12 10:14:24 10.0.0.45 GET /etc/passwd 404 Nikto/2.1.6',
    '2026-03-12 10:14:25 10.0.0.45 GET /xmlrpc.php 404 Nikto/2.1.6',
    '2026-03-12 10:14:26 10.0.0.45 GET /cgi-bin/test.cgi 404 Nikto/2.1.6',
    '2026-03-12 10:14:27 10.0.0.45 GET /backup.zip 404 Nikto/2.1.6',
    '2026-03-12 10:14:28 10.0.0.45 GET /.htaccess 404 Nikto/2.1.6',
    '2026-03-12 10:14:29 10.0.0.45 GET /admin 404 Nikto/2.1.6',
    // Injection attempts — SQLi and XSS in request URLs
    `2026-03-12 10:14:30 172.16.2.30 GET "/search?q=' UNION SELECT username,password FROM users--" 200`,
    '2026-03-12 10:14:31 172.16.2.30 GET "/page?x=<script>alert(1)</script>" 200',
    // High 5xx error rate — 9 errors out of 27 lines (33% ratio)
    '2026-03-12 10:14:32 172.16.3.10 GET /api/notes 500',
    '2026-03-12 10:14:33 172.16.3.10 GET /api/notes 502',
    '2026-03-12 10:14:34 172.16.3.10 GET /api/notes 503',
    '2026-03-12 10:14:35 172.16.3.10 GET /api/notes 500',
    '2026-03-12 10:14:36 172.16.3.10 GET /api/notes 502',
    '2026-03-12 10:14:37 172.16.3.10 GET /api/notes 503',
    '2026-03-12 10:14:38 172.16.3.10 GET /api/notes 500',
    '2026-03-12 10:14:39 172.16.3.10 GET /api/notes 502',
    '2026-03-12 10:14:40 172.16.3.10 GET /api/notes 503'
].join('\n');

const csrfToken = window.getCsrfToken();

const renderResult = (message, type = 'secondary') => {
    resultBox.innerHTML = `<div class="alert alert-${type} mb-0">${message}</div>`;
};

const escapeHtml = (value = '') => {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
};

const renderAlerts = (alerts = []) => {
    if (!alertsGrid) {
        return;
    }

    if (!alerts || alerts.length === 0) {
        alertsGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No security alerts yet. Analyze logs to generate alerts.</div>
            </div>
        `;
        return;
    }

    const cardsHtml = alerts.map((alert) => {
        const severity = escapeHtml(alert.severity || 'low');
        const summary = escapeHtml(alert.summary || 'Security event detected');
        const type = escapeHtml(alert.type || 'unknown');
        const detectedAt = alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'Unknown time';

        return `
            <div class="col-md-6 mb-3">
                <div class="card h-100 security-alert-card severity-${severity}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge text-bg-light text-uppercase">${severity}</span>
                            <small class="text-muted">${escapeHtml(detectedAt)}</small>
                        </div>
                        <h3 class="h6 mb-2">${summary}</h3>
                        <p class="text-muted small mb-0">Type: ${type}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    alertsGrid.innerHTML = cardsHtml;
};

const refreshAlerts = async () => {
    const response = await fetch('/api/security/alerts?limit=20', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh alerts');
    }

    const payload = await response.json();
    renderAlerts(payload.data || []);
};

injectFakeLogButton.addEventListener('click', () => {
    logTextInput.value = SAMPLE_LOG_TEXT;
    renderResult('Sample log injected. Click Analyze Logs to run detection.', 'info');
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const logText = logTextInput.value;

    try {
        renderResult('Analyzing logs...', 'info');

        const response = await fetch('/api/security/log-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ logText })
        });

        const payload = await response.json();

        if (!response.ok) {
            const message = payload.errors && payload.errors.length > 0
                ? payload.errors.join(', ')
                : 'Unable to analyze logs';
            renderResult(message, 'danger');
            return;
        }

        const created = payload.data.createdAlerts;
        const lineInfo = `${payload.data.linesAnalyzed} lines analyzed`;
        const truncationInfo = payload.data.truncated ? ' Input was truncated to safe limit.' : '';

        await refreshAlerts();

        if (created === 0) {
            renderResult(`No suspicious patterns detected. ${lineInfo}.${truncationInfo}`, 'success');
            return;
        }

        renderResult(`${created} alert(s) created. ${lineInfo}.${truncationInfo}`, 'warning');
    } catch (error) {
        renderResult('Unexpected error while analyzing logs.', 'danger');
    }
});

refreshAlerts().catch(() => {
    // Keep server-rendered alerts as fallback if API refresh fails.
});
