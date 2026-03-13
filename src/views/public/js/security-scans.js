const form = document.getElementById('scan-import-form');
const resultBox = document.getElementById('import-result');
const rawInputEl = document.getElementById('rawInput');
const injectSampleButton = document.getElementById('inject-sample-scan');
const scansGrid = document.getElementById('scans-grid');

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

const csrfToken = window.getCsrfToken();

const escapeHtml = (value = '') => {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
};

const renderResult = (message, type = 'secondary') => {
    resultBox.innerHTML = `<div class="alert alert-${escapeHtml(type)} mb-0">${message}</div>`;
};

const renderScans = (scans = []) => {
    if (!scansGrid) {
        return;
    }

    if (!scans || scans.length === 0) {
        scansGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-secondary mb-0">No scans imported yet. Paste scan output above to get started.</div>
            </div>
        `;
        return;
    }

    const cardsHtml = scans.map((scan) => {
        const highCount = (scan.findings || []).filter((f) => f.severity === 'high').length;
        const medCount = (scan.findings || []).filter((f) => f.severity === 'medium').length;
        const lowCount = (scan.findings || []).filter((f) => f.severity === 'low').length;
        const topSeverity = highCount > 0 ? 'high' : (medCount > 0 ? 'medium' : 'low');
        const tool = escapeHtml(scan.tool || 'unknown');
        const target = escapeHtml(scan.target || 'unknown');
        const importedAt = scan.importedAt ? new Date(scan.importedAt).toLocaleString() : 'Unknown time';

        const badgesHtml = [
            highCount > 0 ? `<span class="badge findings-badge-high">${highCount} high</span>` : '',
            medCount > 0 ? `<span class="badge findings-badge-medium">${medCount} medium</span>` : '',
            lowCount > 0 ? `<span class="badge findings-badge-low">${lowCount} low</span>` : '',
            (scan.findings || []).length === 0 ? '<span class="text-muted small">No findings</span>' : ''
        ].filter(Boolean).join(' ');

        const sampleFindings = (scan.findings || []).slice(0, 4);
        const findingItems = sampleFindings
            .map((f) => `<li class="text-truncate">&rsaquo; ${escapeHtml(f.title)}</li>`)
            .join('');
        const moreText = (scan.findings || []).length > 4
            ? `<li class="text-muted fst-italic">... and ${(scan.findings.length - 4)} more</li>`
            : '';

        return `
            <div class="col-md-6 mb-3">
                <div class="card h-100 scan-result-card severity-${escapeHtml(topSeverity)}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="badge text-bg-dark text-uppercase me-1">${tool}</span>
                                <span class="badge text-bg-light text-uppercase">${escapeHtml(topSeverity)}</span>
                            </div>
                            <small class="text-muted">${escapeHtml(importedAt)}</small>
                        </div>
                        <h3 class="h6 mb-2">Target: <strong>${target}</strong></h3>
                        <div class="d-flex gap-2 mb-2">${badgesHtml}</div>
                        <ul class="list-unstyled small text-muted mb-0">${findingItems}${moreText}</ul>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    scansGrid.innerHTML = cardsHtml;
};

const refreshScans = async () => {
    const response = await fetch('/api/security/scans?limit=20', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Unable to refresh scans');
    }

    const payload = await response.json();
    renderScans(payload.data || []);
};

injectSampleButton.addEventListener('click', () => {
    rawInputEl.value = SAMPLE_SCAN_TEXT;
    renderResult('Sample Nikto scan loaded. Click Import Scan to parse and save findings.', 'info');
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawInput = rawInputEl.value;

    try {
        renderResult('Importing scan...', 'info');

        const response = await fetch('/api/security/scan-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ rawInput })
        });

        const payload = await response.json();

        if (!response.ok) {
            const errors = payload.errors ? payload.errors.join(', ') : payload.message;
            renderResult(`Import failed: ${escapeHtml(errors)}`, 'danger');
            return;
        }

        const count = payload.data ? payload.data.findingsCount : 0;
        renderResult(`Scan imported — ${count} finding(s) detected.`, 'success');

        await refreshScans();
    } catch (_err) {
        renderResult('An unexpected error occurred. Please try again.', 'danger');
    }
});

refreshScans().catch(() => {});
