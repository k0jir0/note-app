const { handleApiError } = require('../utils/errorHandler');
const injectionPreventionResearchService = require('../services/injectionPreventionResearchService');

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
        const overview = injectionPreventionResearchService.buildInjectionPreventionModuleOverview({
            baseUrl: resolveBaseUrl(req),
            mongooseLib: req.app && req.app.locals ? req.app.locals.mongooseLib : null
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get injection prevention module overview');
    }
};

exports.evaluateScenario = async (req, res) => {
    try {
        const scenarioId = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId.trim() : '';
        const surface = typeof req.body?.surface === 'string' ? req.body.surface.trim().toLowerCase() : '';
        const payload = req.body?.payload;
        const errors = [];

        if (surface && !['body', 'query', 'params'].includes(surface)) {
            errors.push('surface must be one of body, query, or params');
        }

        if (payload !== undefined && (!payload || typeof payload !== 'object' || Array.isArray(payload))) {
            errors.push('payload must be an object when provided');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const evaluation = injectionPreventionResearchService.evaluateInjectionScenario({
            scenarioId,
            surface,
            payload
        });

        return res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        return handleApiError(res, error, 'Evaluate injection prevention scenario');
    }
};
