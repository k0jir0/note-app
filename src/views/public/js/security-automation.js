const injectSampleButton = document.getElementById('inject-automation-sample');
const resultBox = document.getElementById('automation-sample-result');
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

    const alert = document.createElement('div');
    alert.className = `alert alert-${escapeHtml(type)} mb-0`;
    alert.textContent = String(message);
    resultBox.replaceChildren(alert);
};

if (injectSampleButton) {
    injectSampleButton.addEventListener('click', async () => {
        try {
            renderMessage('Injecting sample automation data...', 'info');

            const response = await fetch('/api/security/automation/sample', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                }
            });

            const payload = await response.json();

            if (!response.ok) {
                const message = payload.errors && payload.errors.length > 0
                    ? payload.errors.join(', ')
                    : 'Unable to inject automation sample right now.';
                renderMessage(message, 'danger');
                return;
            }

            const createdAlerts = payload.data ? payload.data.createdAlerts : 0;
            const findingsCount = payload.data ? payload.data.findingsCount : 0;
            const alertSource = payload.data ? payload.data.alertSource : 'server-log-batch';
            const scanSource = payload.data ? payload.data.scanSource : 'scheduled-scan-import';
            renderMessage(`Injected ${createdAlerts} alert(s) into ${alertSource} and 1 scan import with ${findingsCount} finding(s) into ${scanSource}. These saved records will appear on the other Research pages for this account.`, 'success');
        } catch (_error) {
            renderMessage('Unexpected error while injecting sample automation data.', 'danger');
        }
    });
}
