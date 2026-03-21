(() => {
    const workspace = window.securityWorkspace;
    if (!workspace) {
        return;
    }

    const connectBtn = document.getElementById('realtime-connect-btn');
    const simulateBtn = document.getElementById('realtime-simulate-btn');
    const realtimeLog = document.getElementById('workspace-realtime-log');
    let connectionState = 'disconnected';
    let eventSource = null;
    let activeProbe = null;
    let connectionAttemptId = 0;

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

    const setConnectionState = (nextState) => {
        connectionState = nextState;
        if (!connectBtn) {
            return;
        }

        if (nextState === 'connected') {
            connectBtn.textContent = 'Disconnect Realtime';
            connectBtn.className = 'btn btn-outline-danger';
            return;
        }

        if (nextState === 'connecting') {
            connectBtn.textContent = 'Cancel Realtime';
            connectBtn.className = 'btn btn-outline-warning';
            return;
        }

        connectBtn.textContent = 'Connect Realtime';
        connectBtn.className = 'btn btn-outline-dark';
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

    const clearActiveProbe = ({ abort = false } = {}) => {
        if (!activeProbe) {
            return;
        }

        try {
            activeProbe.onreadystatechange = null;
            activeProbe.ontimeout = null;
            activeProbe.onerror = null;
            if (abort) {
                activeProbe.abort();
            }
        } catch (_error) {
            // best effort cleanup only
        }

        activeProbe = null;
    };

    const disconnectRealtime = ({ silent = false } = {}) => {
        const wasConnected = connectionState === 'connected' || Boolean(eventSource);
        const wasConnecting = connectionState === 'connecting';
        connectionAttemptId += 1;

        clearActiveProbe({ abort: true });

        if (eventSource) {
            try {
                eventSource.onopen = null;
                eventSource.onerror = null;
                eventSource.onmessage = null;
                eventSource.close();
            } catch (_error) {
                // no-op: disconnect should still clear local state
            }
        }

        eventSource = null;
        setConnectionState('disconnected');

        if (silent) {
            return;
        }

        if (wasConnecting) {
            logRealtime('Realtime connection cancelled', 'secondary');
            return;
        }

        if (wasConnected) {
            logRealtime('Realtime disconnected', 'secondary');
        }
    };

    const connectRealtime = () => {
        if (connectionState === 'connected' || eventSource) {
            logRealtime('Already connected to realtime', 'secondary');
            return;
        }

        if (connectionState === 'connecting') {
            logRealtime('Realtime connection is already in progress', 'secondary');
            return;
        }

        const attemptId = connectionAttemptId + 1;
        connectionAttemptId = attemptId;
        setConnectionState('connecting');

        const probe = new XMLHttpRequest();
        activeProbe = probe;
        probe.open('GET', '/api/security/stream?probe=1', true);
        probe.withCredentials = true;
        probe.timeout = 3000;

        let handledResponse = false;

        probe.onreadystatechange = () => {
            if (probe.readyState < 2 || handledResponse) {
                return;
            }

            handledResponse = true;
            if (attemptId !== connectionAttemptId) {
                clearActiveProbe();
                return;
            }

            if (probe.status === 200) {
                try {
                    eventSource = new EventSource('/api/security/stream');
                    eventSource.onopen = () => {
                        if (attemptId !== connectionAttemptId) {
                            disconnectRealtime({ silent: true });
                            return;
                        }

                        clearActiveProbe();
                        setConnectionState('connected');
                        logRealtime('Realtime connected', 'success');
                    };
                    eventSource.onerror = () => {
                        if (attemptId !== connectionAttemptId) {
                            return;
                        }

                        disconnectRealtime();
                        logRealtime('Realtime connection error', 'danger');
                    };
                    eventSource.onmessage = handleMessage;
                } catch (_error) {
                    clearActiveProbe();
                    setConnectionState('disconnected');
                    logRealtime('Unable to open realtime connection', 'danger');
                }
            } else if (probe.status === 401 || probe.status === 403) {
                clearActiveProbe();
                setConnectionState('disconnected');
                logRealtime('Realtime connection denied. Please log in and try again.', 'danger');
            } else if (probe.status === 404) {
                clearActiveProbe();
                setConnectionState('disconnected');
                logRealtime('Realtime endpoint not available on server.', 'danger');
            } else if (probe.status === 0) {
                clearActiveProbe();
                setConnectionState('disconnected');
                logRealtime('Realtime probe timed out or the server is unreachable.', 'danger');
            } else {
                clearActiveProbe();
                setConnectionState('disconnected');
                logRealtime(`Realtime unavailable: HTTP ${probe.status}`, 'danger');
            }

            try {
                probe.abort();
            } catch (_error) {
                // best effort cleanup only
            }
        };

        probe.ontimeout = () => {
            if (attemptId !== connectionAttemptId) {
                return;
            }

            clearActiveProbe();
            setConnectionState('disconnected');
            logRealtime('Realtime probe timed out. Server may be unreachable.', 'danger');
        };

        probe.onerror = () => {
            if (attemptId !== connectionAttemptId) {
                return;
            }

            clearActiveProbe();
            setConnectionState('disconnected');
            logRealtime('Realtime probe failed.', 'danger');
        };

        try {
            probe.send();
        } catch (_error) {
            clearActiveProbe();
            setConnectionState('disconnected');
            logRealtime('Realtime probe failed to send.', 'danger');
        }
    };

    connectBtn?.addEventListener('click', () => {
        if (connectionState === 'connected' || connectionState === 'connecting') {
            disconnectRealtime();
            return;
        }

        connectRealtime();
    });

    if (connectBtn && !connectBtn.disabled) {
        setConnectionState('disconnected');
    }

    window.addEventListener('beforeunload', () => {
        disconnectRealtime({ silent: true });
    });

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
