(() => {
    const workspace = window.securityWorkspace;
    if (!workspace) {
        return;
    }

    const connectBtn = document.getElementById('realtime-connect-btn');
    const simulateBtn = document.getElementById('realtime-simulate-btn');
    const realtimeLog = document.getElementById('workspace-realtime-log');
    let eventSource = null;

    const logRealtime = (message, tone = 'secondary') => {
        if (!realtimeLog) {
            return;
        }

        const line = document.createElement('div');
        line.className = `small text-${tone} mb-1`;
        line.textContent = message;
        realtimeLog.prepend(line);

        while (realtimeLog.childNodes.length > 10) {
            realtimeLog.removeChild(realtimeLog.lastChild);
        }
    };

    const setConnectedState = (connected) => {
        if (!connectBtn) {
            return;
        }

        connectBtn.textContent = connected ? 'Disconnect Realtime' : 'Connect Realtime';
        connectBtn.className = connected ? 'btn btn-outline-danger' : 'btn btn-outline-dark';
    };

    const refreshRealtimePanels = async () => {
        await Promise.all([
            workspace.refreshAlertsPanel ? workspace.refreshAlertsPanel() : Promise.resolve(),
            workspace.refreshCorrelationPanels ? workspace.refreshCorrelationPanels() : Promise.resolve()
        ]);
    };

    const handleMessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload && payload.type === 'alerts') {
                logRealtime(`Realtime: ${payload.created} new alert(s)`, 'muted');
                refreshRealtimePanels().catch(() => void 0);
                return;
            }

            logRealtime(`Realtime event: ${payload && payload.type ? payload.type : 'unknown'}`, 'muted');
        } catch (_error) {
            logRealtime('Realtime: malformed event', 'danger');
        }
    };

    const disconnectRealtime = () => {
        if (!eventSource) {
            return;
        }

        try {
            eventSource.close();
        } catch (_error) {
            // no-op: disconnect should still clear local state
        }

        eventSource = null;
        setConnectedState(false);
        logRealtime('Realtime disconnected', 'secondary');
    };

    const connectRealtime = () => {
        if (eventSource) {
            logRealtime('Already connected to realtime', 'secondary');
            return;
        }

        const probe = new XMLHttpRequest();
        probe.open('GET', '/api/security/stream?probe=1', true);
        probe.withCredentials = true;
        probe.timeout = 3000;

        let handledResponse = false;

        probe.onreadystatechange = () => {
            if (probe.readyState < 2 || handledResponse) {
                return;
            }

            handledResponse = true;

            if (probe.status === 200) {
                try {
                    eventSource = new EventSource('/api/security/stream');
                    eventSource.onopen = () => {
                        setConnectedState(true);
                        logRealtime('Realtime connected', 'success');
                    };
                    eventSource.onerror = () => {
                        disconnectRealtime();
                        logRealtime('Realtime connection error', 'danger');
                    };
                    eventSource.onmessage = handleMessage;
                } catch (_error) {
                    logRealtime('Unable to open realtime connection', 'danger');
                    disconnectRealtime();
                }
            } else if (probe.status === 401 || probe.status === 403) {
                logRealtime('Realtime connection denied. Please log in and try again.', 'danger');
            } else if (probe.status === 404) {
                logRealtime('Realtime endpoint not available on server.', 'danger');
            } else if (probe.status === 0) {
                logRealtime('Realtime probe timed out or the server is unreachable.', 'danger');
            } else {
                logRealtime(`Realtime unavailable: HTTP ${probe.status}`, 'danger');
            }

            try {
                probe.abort();
            } catch (_error) {
                // best effort cleanup only
            }
        };

        probe.ontimeout = () => {
            logRealtime('Realtime probe timed out. Server may be unreachable.', 'danger');
        };

        probe.onerror = () => {
            logRealtime('Realtime probe failed.', 'danger');
        };

        try {
            probe.send();
        } catch (_error) {
            logRealtime('Realtime probe failed to send.', 'danger');
        }
    };

    connectBtn?.addEventListener('click', () => {
        if (eventSource) {
            disconnectRealtime();
            return;
        }

        connectRealtime();
    });

    if (connectBtn && !connectBtn.disabled) {
        setConnectedState(false);
    }

    simulateBtn?.addEventListener('click', async () => {
        try {
            logRealtime('Injecting automation sample...', 'info');
            const response = await fetch('/api/security/automation/sample', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': workspace.csrfToken
                },
                body: '{}'
            });
            const payload = await response.json();

            if (!response.ok) {
                logRealtime('Simulation failed', 'danger');
                return;
            }

            logRealtime(
                `Simulation injected: ${payload.data && payload.data.createdAlerts ? payload.data.createdAlerts : 0} alert(s)`,
                'success'
            );

            setTimeout(() => {
                refreshRealtimePanels().catch(() => void 0);
            }, 1200);
        } catch (_error) {
            logRealtime('Simulation error', 'danger');
        }
    });
})();
