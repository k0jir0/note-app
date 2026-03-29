const rootEl = document.getElementById('audit-telemetry-module-root');
const eventsEndpoint = rootEl && rootEl.dataset ? rootEl.dataset.eventsEndpoint || '/api/audit-telemetry/events' : '/api/audit-telemetry/events';
const statusEl = document.getElementById('audit-history-status');
const refreshBtn = document.getElementById('audit-history-refresh-btn');
const eventCountEl = document.getElementById('audit-history-count');
const eventGridEl = document.getElementById('audit-history-grid');
const paginationEl = document.getElementById('audit-history-pagination');

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

function formatDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Unknown time' : parsed.toLocaleString();
}

function titleize(value = '') {
    const normalized = String(value).replaceAll('_', ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function renderEvents(items = [], pagination = null) {
    if (eventCountEl) {
        eventCountEl.textContent = String(items.length);
    }

    if (!eventGridEl) {
        return;
    }

    if (!items.length) {
        eventGridEl.innerHTML = '<div class="alert alert-secondary mb-0">No persisted audit history is available for this account yet.</div>';
    } else {
        eventGridEl.innerHTML = items.map((event) => {
            const details = [];
            if (event.category) {
                details.push(`Category: ${escapeHtml(titleize(event.category))}`);
            }
            if (event.method || event.path) {
                details.push(`Route: ${escapeHtml(`${event.method || 'EVENT'} ${event.path || ''}`.trim())}`);
            }
            if (event.statusCode) {
                details.push(`Status: ${escapeHtml(event.statusCode)}`);
            }
            if (event.actorEmail) {
                details.push(`Actor: ${escapeHtml(event.actorEmail)}`);
            }

            return `
                <div class="border rounded p-3">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-2 flex-wrap">
                        <div>
                            <div class="fw-semibold">${escapeHtml(event.message || 'Audit event')}</div>
                            <div class="text-muted small">${escapeHtml(formatDate(event.eventTimestamp || event.createdAt))}</div>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <span class="badge text-bg-${escapeHtml(event.level === 'audit' ? 'dark' : event.level === 'error' ? 'danger' : event.level === 'warn' ? 'warning' : 'secondary')} ">${escapeHtml(titleize(event.level || 'info'))}</span>
                            ${event.category ? `<span class="badge text-bg-light">${escapeHtml(titleize(event.category))}</span>` : ''}
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-1 small text-muted mb-2">
                        ${details.map((detail) => `<div>${detail}</div>`).join('')}
                    </div>
                    <details>
                        <summary class="small">View metadata</summary>
                        <pre class="bg-body-tertiary border rounded p-3 small mt-2 mb-0" style="white-space: pre-wrap;">${escapeHtml(JSON.stringify(event.metadata || {}, null, 2))}</pre>
                    </details>
                </div>
            `;
        }).join('');
    }

    if (paginationEl) {
        if (!pagination) {
            paginationEl.innerHTML = '';
        } else {
            paginationEl.innerHTML = `<div class="text-muted small">Page ${escapeHtml(pagination.currentPage)} of ${escapeHtml(pagination.totalPages || 1)} • ${escapeHtml(pagination.totalCount || 0)} matching persisted event(s)</div>`;
        }
    }
}

async function loadEvents() {
    if (refreshBtn) {
        refreshBtn.disabled = true;
    }

    renderStatus('Loading persisted audit history...');

    try {
        const response = await fetch(`${eventsEndpoint}?limit=12`, {
            headers: {
                Accept: 'application/json'
            }
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Unable to load audit history');
        }

        renderEvents(Array.isArray(payload.data) ? payload.data : [], payload.pagination || null);
        renderStatus('Persisted audit history loaded.', 'success');
    } catch (error) {
        renderEvents([], null);
        renderStatus(error && error.message ? error.message : 'Unable to load audit history.', 'danger');
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refreshBtn?.addEventListener('click', () => {
        void loadEvents();
    });

    void loadEvents();
});