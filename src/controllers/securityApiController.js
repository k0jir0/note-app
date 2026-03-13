const SecurityAlert = require('../models/SecurityAlert');
const { analyzeLogText, MAX_LOG_TEXT_LENGTH } = require('../utils/logAnalysis');
const { handleApiError } = require('../utils/errorHandler');

const parseLimit = (value, fallback = 20, max = 100) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(parsed, max);
};

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

        const analysis = analyzeLogText(logText);

        const alertsToCreate = analysis.alerts.map((alert) => ({
            ...alert,
            user: req.user._id,
            source: 'manual-log-input',
            detectedAt: new Date()
        }));

        let savedAlerts = [];
        if (alertsToCreate.length > 0) {
            savedAlerts = await SecurityAlert.insertMany(alertsToCreate);
        }

        return res.status(200).json({
            success: true,
            message: 'Log analysis completed',
            data: {
                linesAnalyzed: analysis.linesAnalyzed,
                truncated: analysis.truncated,
                inputLimit: MAX_LOG_TEXT_LENGTH,
                createdAlerts: savedAlerts.length,
                alerts: savedAlerts
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Analyze logs');
    }
};

exports.getAlerts = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 100);

        const alerts = await SecurityAlert.find({ user: req.user._id })
            .sort({ detectedAt: -1, createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        return handleApiError(res, error, 'Get security alerts');
    }
};
