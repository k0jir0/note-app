const { handleApiError } = require('../utils/errorHandler');
const playwrightResearchService = require('../services/playwrightResearchService');

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
        const overview = playwrightResearchService.buildPlaywrightModuleOverview({
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get Playwright module overview');
    }
};

exports.getScript = async (req, res) => {
    try {
        const scenarioId = typeof req.query?.scenarioId === 'string' && req.query.scenarioId.trim()
            ? req.query.scenarioId.trim()
            : playwrightResearchService.DEFAULT_SCENARIO_ID;

        if (!playwrightResearchService.getScenarioIds().includes(scenarioId)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['scenarioId must match a registered Playwright scenario']
            });
        }

        const script = playwrightResearchService.buildPlaywrightScript({
            baseUrl: resolveBaseUrl(req),
            scenarioId
        });

        return res.status(200).json({
            success: true,
            data: script
        });
    } catch (error) {
        return handleApiError(res, error, 'Get Playwright script template');
    }
};
