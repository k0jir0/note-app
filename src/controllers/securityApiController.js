const { handleApiError } = require('../utils/errorHandler');
const securityWorkspaceService = require('../services/securityWorkspaceService');
const securityRealtimeService = require('../services/securityRealtimeService');

exports.analyzeLogs = async (req, res) => {
    try {
        const logText = typeof req.body.logText === 'string' ? req.body.logText : '';

        if (!logText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['logText is required']
            });
        }

        const result = await securityWorkspaceService.analyzeLogsForUser({
            userId: req.user._id,
            logText
        });

        return res.status(200).json({
            success: true,
            message: 'Log analysis completed',
            data: {
                linesAnalyzed: result.linesAnalyzed,
                truncated: result.truncated,
                inputLimit: result.inputLimit,
                createdAlerts: result.createdAlerts,
                alerts: result.alerts
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Analyze logs');
    }
};

exports.getAlerts = async (req, res) => {
    try {
        const payload = await securityWorkspaceService.listAlertsForUser({
            userId: req.user._id,
            limit: securityWorkspaceService.parseLimit(req.query.limit, 20, 100),
            sort: securityWorkspaceService.normalizeAlertSort(req.query.sort)
        });

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return handleApiError(res, error, 'Get security alerts');
    }
};

exports.updateAlertFeedback = async (req, res) => {
    try {
        const result = await securityWorkspaceService.updateAlertFeedbackForUser({
            userId: req.user._id,
            alertId: typeof req.params.id === 'string' ? req.params.id.trim() : '',
            feedbackLabel: typeof req.body?.feedbackLabel === 'string'
                ? req.body.feedbackLabel.trim()
                : ''
        });

        if (!result.ok) {
            return res.status(result.status).json({
                success: false,
                message: result.message,
                errors: result.errors
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return handleApiError(res, error, 'Update alert feedback');
    }
};

exports.getCorrelations = async (req, res) => {
    try {
        const payload = await securityWorkspaceService.listCorrelationsForUser({
            userId: req.user._id,
            limit: securityWorkspaceService.parseLimit(req.query.limit, 20, 50)
        });

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return handleApiError(res, error, 'Get correlations');
    }
};

exports.getSampleCorrelations = async (req, res) => {
    try {
        const payload = await securityWorkspaceService.createSampleCorrelationsForUser({
            userId: req.user._id
        });

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return handleApiError(res, error, 'Get sample correlations');
    }
};

exports.injectAutomationSample = async (req, res) => {
    try {
        const runtimeAutomation = (req.app && req.app.locals && req.app.locals.runtimeConfig && req.app.locals.runtimeConfig.automation)
            ? req.app.locals.runtimeConfig.automation
            : {};

        const payload = await securityWorkspaceService.injectAutomationSampleForUser({
            userId: req.user._id,
            runtimeAutomation
        });

        console.log(`[automation] sample injection created ${payload.data.createdAlerts} alert(s) and ${payload.data.findingsCount || 0} finding(s) for user ${req.user._id}`);

        return res.status(200).json({
            success: true,
            ...payload
        });
    } catch (error) {
        return handleApiError(res, error, 'Inject automation sample');
    }
};

exports.realtimeIngest = async (req, res) => {
    try {
        const result = await securityRealtimeService.enqueueRealtimeIngest({
            appLocals: req.app && req.app.locals,
            userId: req.user._id,
            payload: req.body || {}
        });

        if (!result.ok) {
            return res.status(result.status).json({
                success: false,
                message: result.message,
                errors: result.errors
            });
        }

        return res.status(result.status).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return handleApiError(res, error, 'Realtime ingest');
    }
};

exports.streamEvents = async (req, res) => {
    try {
        const probeResponse = await securityRealtimeService.respondToRealtimeProbe({
            appLocals: req.app && req.app.locals,
            query: req.query,
            res
        });
        if (probeResponse) {
            return probeResponse;
        }

        return securityRealtimeService.openRealtimeEventStream({
            appLocals: req.app && req.app.locals,
            userId: req.user && req.user._id,
            req,
            res
        });
    } catch (error) {
        return handleApiError(res, error, 'Stream events');
    }
};
