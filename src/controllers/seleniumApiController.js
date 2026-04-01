const { handleApiError } = require('../utils/errorHandler');
const seleniumResearchService = require('../services/seleniumResearchService');

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
        const overview = seleniumResearchService.buildSeleniumModuleOverview({
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get Selenium module overview');
    }
};

exports.getScript = async (req, res) => {
    try {
        const scenarioId = typeof req.query?.scenarioId === 'string' && req.query.scenarioId.trim()
            ? req.query.scenarioId.trim()
            : seleniumResearchService.DEFAULT_SCENARIO_ID;

        if (!seleniumResearchService.getScenarioIds().includes(scenarioId)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['scenarioId must match a registered Selenium scenario']
            });
        }

        const script = seleniumResearchService.buildSeleniumScript({
            baseUrl: resolveBaseUrl(req),
            scenarioId
        });

        return res.status(200).json({
            success: true,
            data: script
        });
    } catch (error) {
        return handleApiError(res, error, 'Get Selenium script template');
    }
};
