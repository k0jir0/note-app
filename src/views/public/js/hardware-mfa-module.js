const rootEl = document.getElementById('hardware-mfa-module-root');
const overviewEndpoint = rootEl?.dataset?.hardwareMfaOverviewEndpoint || '/api/hardware-mfa/overview';
const registerOptionsEndpoint = rootEl?.dataset?.hardwareMfaRegisterOptionsEndpoint || '/api/hardware-mfa/register/options';
const registerVerifyEndpoint = rootEl?.dataset?.hardwareMfaRegisterVerifyEndpoint || '/api/hardware-mfa/register/verify';
const registerPkiEndpoint = rootEl?.dataset?.hardwareMfaPkiRegisterEndpoint || '/api/hardware-mfa/pki/register-current';
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
const registerLabelInput = document.getElementById('hardware-mfa-register-label');
const instructionsEl = document.getElementById('hardware-mfa-challenge-instructions');
const transportStatusEl = document.getElementById('hardware-mfa-transport-status');
const principlesEl = document.getElementById('hardware-mfa-principles');
const sensitiveActionsEl = document.getElementById('hardware-mfa-sensitive-actions');
const refreshBtn = document.getElementById('hardware-mfa-refresh-btn');
const revokeBtn = document.getElementById('hardware-mfa-revoke-btn');
const registerBtn = document.getElementById('hardware-mfa-register-btn');
const registerPkiBtn = document.getElementById('hardware-mfa-register-pki-btn');
const startBtn = document.getElementById('hardware-mfa-start-btn');
const verifyBtn = document.getElementById('hardware-mfa-verify-btn');

let pendingAssertion = null;
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

function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToUint8Array(value = '') {
    const padded = String(value).replace(/-/g, '+').replace(/_/g, '/')
        .padEnd(Math.ceil(String(value).length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function browserSupportsWebAuthn() {
    return typeof window.PublicKeyCredential !== 'undefined'
        && !!navigator.credentials
        && typeof navigator.credentials.create === 'function'
        && typeof navigator.credentials.get === 'function';
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

function prepareCreateOptions(options = {}) {
    return {
        ...options,
        challenge: base64UrlToUint8Array(options.challenge),
        user: {
            ...options.user,
            id: base64UrlToUint8Array(options.user.id)
        },
        excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
            ...credential,
            id: base64UrlToUint8Array(credential.id)
        }))
    };
}

function prepareRequestOptions(options = {}) {
    return {
        ...options,
        challenge: base64UrlToUint8Array(options.challenge),
        allowCredentials: (options.allowCredentials || []).map((credential) => ({
            ...credential,
            id: base64UrlToUint8Array(credential.id)
        }))
    };
}

function serializeRegistrationCredential(credential) {
    if (!credential || !credential.response) {
        throw new Error('The browser did not return a valid WebAuthn registration response.');
    }

    if (typeof credential.response.getPublicKey !== 'function' || typeof credential.response.getAuthenticatorData !== 'function') {
        throw new Error('This browser does not expose the WebAuthn public-key registration APIs needed by the server.');
    }

    return {
        id: credential.id,
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
            authenticatorData: bufferToBase64Url(credential.response.getAuthenticatorData()),
            publicKey: bufferToBase64Url(credential.response.getPublicKey()),
            publicKeyAlgorithm: credential.response.getPublicKeyAlgorithm(),
            transports: typeof credential.response.getTransports === 'function'
                ? credential.response.getTransports()
                : []
        },
        label: registerLabelInput?.value?.trim() || 'Registered security key'
    };
}

function serializeAssertionCredential(credential) {
    if (!credential || !credential.response) {
        throw new Error('The browser did not return a valid WebAuthn assertion.');
    }

    return {
        id: credential.id,
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
            authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
            signature: bufferToBase64Url(credential.response.signature),
            userHandle: credential.response.userHandle ? bufferToBase64Url(credential.response.userHandle) : ''
        }
    };
}

function renderSessionSummary(profile = {}, sessionAssurance = {}, activeChallenge = {}, activeRegistration = {}) {
    if (sessionBadgeEl) {
        sessionBadgeEl.textContent = sessionAssurance.verified ? 'Verified' : 'Not verified';
    }

    if (methodBadgeEl) {
        methodBadgeEl.textContent = prettyLabel(sessionAssurance.method || 'none') || 'None';
    }

    if (!sessionSummaryEl) {
        return;
    }

    const hardwareTokenMode = (profile.registeredAuthenticators || []).find((entry) => entry.method === 'hardware_token')?.kind || 'unregistered';

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
            <dt class="col-sm-5">Security key mode</dt>
            <dd class="col-sm-7">${escapeHtml(prettyLabel(hardwareTokenMode))}</dd>
            <dt class="col-sm-5">Verified at</dt>
            <dd class="col-sm-7">${escapeHtml(formatTimestamp(sessionAssurance.verifiedAt))}</dd>
            <dt class="col-sm-5">Expires at</dt>
            <dd class="col-sm-7">${escapeHtml(formatTimestamp(sessionAssurance.expiresAt))}</dd>
            <dt class="col-sm-5">Active challenge</dt>
            <dd class="col-sm-7">${activeChallenge.active ? escapeHtml(activeChallenge.challengeId || 'Issued') : 'None'}</dd>
            <dt class="col-sm-5">Registration state</dt>
            <dd class="col-sm-7">${activeRegistration.active ? escapeHtml(activeRegistration.challengeId || 'Pending') : 'None'}</dd>
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
                <p class="small mb-1">${escapeHtml(authenticator.challengeHint || '')}</p>
                ${authenticator.kind ? `<p class="small mb-0"><strong>Mode:</strong> ${escapeHtml(prettyLabel(authenticator.kind))}</p>` : ''}
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

function renderTransportStatus(environment = {}, capabilities = {}) {
    if (!transportStatusEl) {
        return;
    }

    const transport = environment.transport || {};
    const parts = [
        `Protocol: ${prettyLabel(transport.protocol || 'http')}`
    ];

    if (capabilities.directMutualTls) {
        parts.push('Direct mTLS client-certificate verification is enabled.');
    } else if (capabilities.trustedProxyCertificateHeaders) {
        parts.push('PKI verification is enabled through trusted reverse-proxy certificate headers.');
    } else {
        parts.push('PKI registration and step-up require either HTTPS client-certificate support or trusted proxy certificate headers.');
    }

    transportStatusEl.textContent = parts.join(' ');

    if (registerPkiBtn) {
        registerPkiBtn.disabled = !capabilities.pkiRegistration;
        registerPkiBtn.title = capabilities.pkiRegistration
            ? ''
            : 'Enable direct mTLS or trusted proxy certificate headers before registering a PKI certificate.';
    }
}

function renderOverview(overview) {
    const profileWithAuthenticators = {
        ...(overview.currentProfile || {}),
        registeredAuthenticators: overview.registeredAuthenticators || []
    };

    renderSessionSummary(
        profileWithAuthenticators,
        overview.sessionAssurance || {},
        overview.activeChallenge || {},
        overview.activeRegistration || {}
    );
    renderAuthenticators(overview.registeredAuthenticators || []);
    renderPrinciples(overview.policyPrinciples || []);
    renderSensitiveActions(overview.sensitiveActions || []);
    populateMethods(
        overview.registeredAuthenticators || [],
        overview.supportedAuthenticators || [],
        overview.activeChallenge || {}
    );
    renderActiveChallenge(overview.activeChallenge || {});
    renderTransportStatus(overview.environment || {}, overview.capabilities || {});
}

async function loadOverview() {
    const overview = await requestJson(overviewEndpoint);
    renderOverview(overview);
    renderStatus('Hardware-Backed MFA Module ready.', 'secondary');
}

async function registerSecurityKey() {
    if (!browserSupportsWebAuthn()) {
        throw new Error('This browser does not support WebAuthn security-key registration.');
    }

    const registration = await requestJson(registerOptionsEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({})
    });
    const credential = await navigator.credentials.create({
        publicKey: prepareCreateOptions(registration.publicKey)
    });
    const result = await requestJson(registerVerifyEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
            registrationResponse: serializeRegistrationCredential(credential)
        })
    });

    renderStatus(`Security key registered: ${result.label}.`, 'success');
    await loadOverview();
}

async function registerCurrentPkiCertificate() {
    const result = await requestJson(registerPkiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({})
    });

    renderStatus(`Registered PKI certificate ${result.subject}.`, 'success');
    await loadOverview();
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

    pendingAssertion = null;

    if (challengeIdInput) {
        challengeIdInput.value = challenge.challengeId || '';
    }

    if (instructionsEl) {
        instructionsEl.textContent = challenge.instructions || 'Challenge issued.';
    }

    if (responseInput) {
        responseInput.value = '';
    }

    if (challenge.verificationMode === 'webauthn_assertion') {
        if (!browserSupportsWebAuthn()) {
            throw new Error('This browser does not support WebAuthn assertions for security-key step-up.');
        }

        const credential = await navigator.credentials.get({
            publicKey: prepareRequestOptions(challenge.publicKey)
        });
        pendingAssertion = serializeAssertionCredential(credential);
        renderStatus(`Security key assertion captured for challenge ${challenge.challengeId || ''}. Click Verify to complete the step-up.`, 'secondary');
        await loadOverview();
        return;
    }

    renderStatus(`Hardware-first challenge ${challenge.challengeId || ''} is ready.`, 'secondary');
    await loadOverview();
}

async function verifyChallenge() {
    const method = methodSelect?.value || '';
    const payload = {
        method,
        challengeId: challengeIdInput?.value || '',
        responseValue: responseInput?.value || ''
    };

    if (method === 'hardware_token' && pendingAssertion) {
        payload.assertion = pendingAssertion;
    }

    const result = await requestJson(verifyEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
    });

    pendingAssertion = null;
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

    pendingAssertion = null;
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
        renderStatus(error.message || 'Unable to load the Hardware-Backed MFA Module.', 'danger');
        return;
    }

    registerBtn?.addEventListener('click', async () => {
        try {
            await registerSecurityKey();
        } catch (error) {
            renderStatus(error.message || 'Unable to register the security key.', 'danger');
        }
    });

    registerPkiBtn?.addEventListener('click', async () => {
        try {
            await registerCurrentPkiCertificate();
        } catch (error) {
            renderStatus(error.message || 'Unable to register the current PKI certificate.', 'danger');
        }
    });

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
