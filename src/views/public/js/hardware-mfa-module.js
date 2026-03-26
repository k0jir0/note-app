const rootEl = document.getElementById('hardware-mfa-module-root');
const overviewEndpoint = rootEl?.dataset?.hardwareMfaOverviewEndpoint || '/api/hardware-mfa/overview';
const challengeEndpoint = rootEl?.dataset?.hardwareMfaChallengeEndpoint || '/api/hardware-mfa/challenge';
const verifyEndpoint = rootEl?.dataset?.hardwareMfaVerifyEndpoint || '/api/hardware-mfa/verify';
const revokeEndpoint = rootEl?.dataset?.hardwareMfaRevokeEndpoint || '/api/hardware-mfa/revoke';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const statusEl = document.getElementById('hardware-mfa-status');
const sessionBadgeEl = document.getElementById('hardware-mfa-session-badge');
const methodBadgeEl = document.getElementById('hardware-mfa-method-badge');
const factorCountEl = document.getElementById('hardware-mfa-factor-count');
const sensitiveCountEl = document.getElementById('hardware-mfa-sensitive-count');
const sessionSummaryEl = document.getElementById('hardware-mfa-session-summary');
const authenticatorGridEl = document.getElementById('hardware-mfa-authenticator-grid');
const methodSelect = document.getElementById('hardware-mfa-method-select');
const challengeIdInput = document.getElementById('hardware-mfa-challenge-id');
const responseInput = document.getElementById('hardware-mfa-response');
const instructionsEl = document.getElementById('hardware-mfa-challenge-instructions');
const principlesEl = document.getElementById('hardware-mfa-principles');
const sensitiveActionsEl = document.getElementById('hardware-mfa-sensitive-actions');
const refreshBtn = document.getElementById('hardware-mfa-refresh-btn');
const revokeBtn = document.getElementById('hardware-mfa-revoke-btn');
const startBtn = document.getElementById('hardware-mfa-start-btn');
const verifyBtn = document.getElementById('hardware-mfa-verify-btn');

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

function prettyLabel(value = '') {
    return String(value || '')
        .split(/[_-]+/)
        .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
        .join(' ');
}

function formatTimestamp(value) {
    if (!value) {
        return 'Not available';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString();
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

function renderSessionSummary(profile = {}, sessionAssurance = {}, activeChallenge = {}) {
    if (sessionBadgeEl) {
        sessionBadgeEl.textContent = sessionAssurance.verified ? 'Verified' : 'Not verified';
    }

    if (methodBadgeEl) {
        methodBadgeEl.textContent = prettyLabel(sessionAssurance.method || 'none') || 'None';
    }

    if (!sessionSummaryEl) {
        return;
    }

    sessionSummaryEl.innerHTML = `
        <dl class="row mb-0">
            <dt class="col-sm-5">Role</dt>
            <dd class="col-sm-7">${escapeHtml(prettyLabel(profile.missionRole || '-'))}</dd>
            <dt class="col-sm-5">Clearance</dt>
            <dd class="col-sm-7">${escapeHtml(prettyLabel(profile.clearance || '-'))}</dd>
            <dt class="col-sm-5">Current MFA method</dt>
            <dd class="col-sm-7">${escapeHtml(prettyLabel(profile.mfaMethod || 'none'))}</dd>
            <dt class="col-sm-5">Hardware-first</dt>
            <dd class="col-sm-7">${sessionAssurance.hardwareFirst ? 'Yes' : 'No'}</dd>
            <dt class="col-sm-5">Verified at</dt>
            <dd class="col-sm-7">${escapeHtml(formatTimestamp(sessionAssurance.verifiedAt))}</dd>
            <dt class="col-sm-5">Expires at</dt>
            <dd class="col-sm-7">${escapeHtml(formatTimestamp(sessionAssurance.expiresAt))}</dd>
            <dt class="col-sm-5">Active challenge</dt>
            <dd class="col-sm-7">${activeChallenge.active ? escapeHtml(activeChallenge.challengeId || 'Issued') : 'None'}</dd>
        </dl>
    `;
}

function renderAuthenticators(items = []) {
    if (factorCountEl) {
        factorCountEl.textContent = String(items.length);
    }

    if (!authenticatorGridEl) {
        return;
    }

    if (!items.length) {
        authenticatorGridEl.innerHTML = '<div class="col-12"><p class="text-muted mb-0">No registered hardware-first authenticators are available for this session.</p></div>';
        return;
    }

    authenticatorGridEl.innerHTML = items.map((authenticator) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                    <p class="fw-semibold mb-0">${escapeHtml(authenticator.label)}</p>
                    <span class="badge text-bg-light">${escapeHtml(prettyLabel(authenticator.method))}</span>
                </div>
                <p class="text-muted mb-2">${escapeHtml(authenticator.evidence || '')}</p>
                <p class="small mb-0">${escapeHtml(authenticator.challengeHint || '')}</p>
            </div>
        </div>
    `).join('');
}

function renderPrinciples(items = []) {
    if (!principlesEl) {
        return;
    }

    principlesEl.innerHTML = items.map((item) => `
        <div class="col-md-6">
            <div class="playwright-prereq-card h-100">
                <p class="fw-semibold mb-2">${escapeHtml(item.label)}</p>
                <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');
}

function renderSensitiveActions(items = []) {
    if (sensitiveCountEl) {
        sensitiveCountEl.textContent = String(items.length);
    }

    if (!sensitiveActionsEl) {
        return;
    }

    sensitiveActionsEl.innerHTML = items.map((item) => `
        <div class="playwright-scenario-card">
            <div class="d-flex justify-content-between gap-3 mb-2 flex-wrap">
                <div>
                    <p class="research-kicker mb-1">${escapeHtml(item.sensitivity || 'high')}</p>
                    <h3 class="h6 mb-1">${escapeHtml(item.label)}</h3>
                </div>
                <span class="badge text-bg-dark">${escapeHtml(prettyLabel(item.requiredMfaMethod || 'none'))}</span>
            </div>
            <p class="text-muted mb-0">${escapeHtml(item.description || '')}</p>
        </div>
    `).join('');
}

function populateMethods(authenticators = [], supportedAuthenticators = [], activeChallenge = {}) {
    if (!methodSelect) {
        return;
    }

    const availableMethods = authenticators.length
        ? authenticators.map((authenticator) => authenticator.method)
        : supportedAuthenticators.map((authenticator) => authenticator.method);

    methodSelect.innerHTML = availableMethods.map((method) => `
        <option value="${escapeHtml(method)}">${escapeHtml(prettyLabel(method))}</option>
    `).join('');

    if (activeChallenge && activeChallenge.method && availableMethods.includes(activeChallenge.method)) {
        methodSelect.value = activeChallenge.method;
    }
}

function renderActiveChallenge(challenge = {}) {
    if (challengeIdInput) {
        challengeIdInput.value = challenge.active ? (challenge.challengeId || '') : '';
    }

    if (instructionsEl) {
        instructionsEl.textContent = challenge.active
            ? `Challenge ${challenge.challengeId || ''} is active until ${formatTimestamp(challenge.expiresAt)}.`
            : 'Start a challenge to see the expected proof for the current method.';
    }
}

function renderOverview(overview) {
    renderSessionSummary(overview.currentProfile || {}, overview.sessionAssurance || {}, overview.activeChallenge || {});
    renderAuthenticators(overview.registeredAuthenticators || []);
    renderPrinciples(overview.policyPrinciples || []);
    renderSensitiveActions(overview.sensitiveActions || []);
    populateMethods(
        overview.registeredAuthenticators || [],
        overview.supportedAuthenticators || [],
        overview.activeChallenge || {}
    );
    renderActiveChallenge(overview.activeChallenge || {});
}

async function loadOverview() {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);
    renderStatus('Hardware-First MFA Module ready.', 'secondary');
}

async function startChallenge() {
    const method = methodSelect?.value || '';
    const challenge = await requestJson(challengeEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ method })
    });

    if (challengeIdInput) {
        challengeIdInput.value = challenge.challengeId || '';
    }

    if (instructionsEl) {
        instructionsEl.textContent = challenge.instructions || 'Challenge issued.';
    }

    if (responseInput) {
        responseInput.value = '';
    }

    renderStatus(`Hardware-first challenge ${challenge.challengeId || ''} is ready.`, 'secondary');
    await loadOverview();
}

async function verifyChallenge() {
    const result = await requestJson(verifyEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            method: methodSelect?.value || '',
            challengeId: challengeIdInput?.value || '',
            responseValue: responseInput?.value || ''
        })
    });

    renderStatus(
        `Hardware-first MFA verified with ${prettyLabel(result.method || 'none')}.`,
        result.hardwareFirst ? 'success' : 'warning'
    );
    await loadOverview();
}

async function revokeSession() {
    await requestJson(revokeEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({})
    });

    if (responseInput) {
        responseInput.value = '';
    }

    renderStatus('Hardware-first session assurance revoked.', 'secondary');
    await loadOverview();
}

async function initializeHardwareMfaModule() {
    if (!rootEl) {
        return;
    }

    try {
        await loadOverview();
    } catch (error) {
        renderStatus(error.message || 'Unable to load the Hardware-First MFA Module.', 'danger');
        return;
    }

    refreshBtn?.addEventListener('click', async () => {
        try {
            await loadOverview();
        } catch (error) {
            renderStatus(error.message || 'Unable to refresh the module.', 'danger');
        }
    });

    startBtn?.addEventListener('click', async () => {
        try {
            await startChallenge();
        } catch (error) {
            renderStatus(error.message || 'Unable to start the hardware-first challenge.', 'danger');
        }
    });

    verifyBtn?.addEventListener('click', async () => {
        try {
            await verifyChallenge();
        } catch (error) {
            renderStatus(error.message || 'Unable to verify the hardware-first challenge.', 'danger');
        }
    });

    revokeBtn?.addEventListener('click', async () => {
        try {
            await revokeSession();
        } catch (error) {
            renderStatus(error.message || 'Unable to revoke the hardware-first session.', 'danger');
        }
    });
}

void initializeHardwareMfaModule();
