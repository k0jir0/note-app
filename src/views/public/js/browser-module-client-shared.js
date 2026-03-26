(function registerBrowserResearchModuleShared(globalObject) {
    function escapeHtml(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll('\'', '&#39;');
    }

    function formatDateTime(value) {
        if (!value) {
            return '';
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return String(value);
        }

        return parsed.toLocaleString();
    }

    function getRunTone(status) {
        switch (status) {
            case 'passed':
                return 'success';
            case 'failed':
                return 'danger';
            case 'flaky':
                return 'warning';
            case 'skipped':
                return 'secondary';
            default:
                return 'light';
        }
    }

    async function requestJson(url, fallbackMessage) {
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(fallbackMessage || 'The server returned an unexpected response.');
            }

            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || fallbackMessage || 'The request could not be completed.');
            }

            return payload.data;
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error('Could not reach the server. Refresh the page and confirm the app is still running on localhost:3000.');
            }

            throw error;
        }
    }

    function populateScenarioSelect(selectEl, items = [], defaultScenarioId = '') {
        if (!selectEl) {
            return;
        }

        selectEl.innerHTML = items.map((scenario) => `
            <option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.title)}</option>
        `).join('');

        if (defaultScenarioId) {
            selectEl.value = defaultScenarioId;
        }
    }

    function createModuleController({
        rootId,
        datasetKeys,
        defaultEndpoints,
        statusTargetId,
        scenarioSelectId,
        refreshButtonId,
        loadButtonId,
        copyButtonId,
        fallbackScenarioId,
        overviewErrorMessage,
        scriptErrorMessage,
        readyMessage,
        refreshSuccessMessage,
        loadSuccessMessage,
        changeSuccessMessage,
        copyEmptyMessage,
        copyUnsupportedMessage,
        buildCopySuccessMessage,
        renderOverview,
        renderScript
    } = {}) {
        const rootEl = document.getElementById(rootId);
        const rootDataset = rootEl && rootEl.dataset ? rootEl.dataset : {};
        const overviewEndpoint = rootDataset[datasetKeys.overview] || defaultEndpoints.overview;
        const scriptEndpoint = rootDataset[datasetKeys.script] || defaultEndpoints.script;
        const statusTarget = document.getElementById(statusTargetId);
        const scenarioSelect = document.getElementById(scenarioSelectId);
        const refreshBtn = document.getElementById(refreshButtonId);
        const loadScriptBtn = document.getElementById(loadButtonId);
        const copyScriptBtn = document.getElementById(copyButtonId);

        let latestOverview = null;
        let latestScript = null;

        function renderStatus(message, tone = 'secondary') {
            if (!statusTarget) {
                return;
            }

            statusTarget.innerHTML = `<div class="alert alert-${escapeHtml(tone)} mb-0">${escapeHtml(message)}</div>`;
        }

        function getSelectedScenarioId() {
            if (scenarioSelect && scenarioSelect.value) {
                return scenarioSelect.value;
            }

            if (latestOverview && latestOverview.defaultScenarioId) {
                return latestOverview.defaultScenarioId;
            }

            return fallbackScenarioId;
        }

        async function loadScript() {
            const scenarioId = getSelectedScenarioId();
            const url = `${scriptEndpoint}?scenarioId=${encodeURIComponent(scenarioId)}`;
            const script = await requestJson(url, scriptErrorMessage);

            latestScript = script;
            renderScript(script, {
                escapeHtml,
                formatDateTime,
                getRunTone,
                latestOverview,
                renderStatus
            });

            return script;
        }

        async function refreshModule(showMessage = false) {
            const overview = await requestJson(overviewEndpoint, overviewErrorMessage);

            latestOverview = overview;
            renderOverview(overview, {
                escapeHtml,
                formatDateTime,
                getRunTone,
                populateScenarioSelect: (items, defaultScenarioId) => populateScenarioSelect(scenarioSelect, items, defaultScenarioId),
                renderStatus
            });

            await loadScript();

            if (showMessage) {
                renderStatus(refreshSuccessMessage, 'secondary');
            }
        }

        async function copyCurrentScript() {
            if (!latestScript || !latestScript.content) {
                renderStatus(copyEmptyMessage, 'warning');
                return;
            }

            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                renderStatus(copyUnsupportedMessage, 'warning');
                return;
            }

            await navigator.clipboard.writeText(latestScript.content);
            renderStatus(buildCopySuccessMessage(latestScript), 'success');
        }

        async function initialize() {
            try {
                await refreshModule(false);
                renderStatus(readyMessage, 'secondary');
            } catch (error) {
                renderStatus(error.message || overviewErrorMessage, 'danger');
            }
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshModule(true).catch((error) => {
                    renderStatus(error.message || overviewErrorMessage, 'danger');
                });
            });
        }

        if (loadScriptBtn) {
            loadScriptBtn.addEventListener('click', () => {
                loadScript().then(() => {
                    renderStatus(loadSuccessMessage, 'success');
                }).catch((error) => {
                    renderStatus(error.message || scriptErrorMessage, 'danger');
                });
            });
        }

        if (copyScriptBtn) {
            copyScriptBtn.addEventListener('click', () => {
                copyCurrentScript().catch((error) => {
                    renderStatus(error.message || 'Unable to copy the current script.', 'danger');
                });
            });
        }

        if (scenarioSelect) {
            scenarioSelect.addEventListener('change', () => {
                loadScript().then(() => {
                    renderStatus(changeSuccessMessage, 'secondary');
                }).catch((error) => {
                    renderStatus(error.message || scriptErrorMessage, 'danger');
                });
            });
        }

        return {
            initialize,
            refreshModule,
            loadScript,
            copyCurrentScript
        };
    }

    globalObject.BrowserResearchModuleShared = Object.freeze({
        createModuleController,
        escapeHtml,
        formatDateTime,
        getRunTone,
        populateScenarioSelect,
        requestJson
    });
}(window));
