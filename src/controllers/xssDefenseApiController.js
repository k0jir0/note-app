const { handleApiError } = require('../utils/errorHandler');
const xssDefenseResearchService = require('../services/xssDefenseResearchService');

function resolveBaseUrl(req) {
    if (req.app && req.app.locals && req.app.locals.appBaseUrl) {
        return req.app.locals.appBaseUrl;
    }

    if (typeof req.get === 'function') {
        const host = req.get('host');
        if (host) {
            return `${req.protocol || 'http'}://${host}`;
        }
    }

    return 'http://localhost:3000';
}

exports.getOverview = async (req, res) => {
    try {
        const overview = xssDefenseResearchService.buildXssDefenseModuleOverview({
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get XSS defense module overview');
    }
};

exports.evaluateScenario = async (req, res) => {
    try {
        const scenarioId = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId.trim() : '';
        const payload = req.body?.payload;
        const errors = [];

        if (payload !== undefined && typeof payload !== 'string') {
            errors.push('payload must be a string when provided');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const evaluation = xssDefenseResearchService.evaluateXssScenario({
            scenarioId,
            payload
        });

        return res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        return handleApiError(res, error, 'Evaluate XSS defense scenario');
    }
};
