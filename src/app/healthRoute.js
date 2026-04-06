const { canReadOperationalDiagnostics } = require('../services/operationalDiagnosticsAccessService');

function buildHealthResponse(req, res) {
    const breakGlass = res.locals && res.locals.breakGlass
        ? res.locals.breakGlass
        : (req.app && req.app.locals ? req.app.locals.breakGlass : null);
    const offline = Boolean(breakGlass && breakGlass.offline);
    const diagnosticsAllowed = canReadOperationalDiagnostics(req);
    const statusCode = offline ? 503 : 200;

    if (!diagnosticsAllowed) {
        return {
            statusCode,
            body: {
                ok: !offline,
                detailsRestricted: true
            }
        };
    }

    const auditClient = req.app && req.app.locals ? req.app.locals.immutableLogClient : null;
    const auditDelivery = auditClient && typeof auditClient.getDeliveryState === 'function'
        ? auditClient.getDeliveryState()
        : null;

    return {
        statusCode,
        body: {
            ok: !offline,
            detailsRestricted: false,
            breakGlass: {
                mode: breakGlass && breakGlass.mode ? breakGlass.mode : 'disabled',
                enabled: Boolean(breakGlass && breakGlass.enabled)
            },
            immutableLogging: {
                enabled: Boolean(auditClient && auditClient.enabled),
                healthy: auditDelivery ? Boolean(auditDelivery.healthy) : true,
                degraded: auditDelivery ? Boolean(auditDelivery.degraded) : false,
                requireRemoteSuccess: auditDelivery
                    ? Boolean(auditDelivery.requireRemoteSuccess)
                    : Boolean(auditClient && auditClient.requireRemoteSuccess)
            }
        }
    };
}

function registerHealthRoute(app) {
    app.get('/healthz', (req, res) => {
        const response = buildHealthResponse(req, res);
        return res.status(response.statusCode).json(response.body);
    });

    return app;
}

module.exports = {
    buildHealthResponse,
    registerHealthRoute
};
