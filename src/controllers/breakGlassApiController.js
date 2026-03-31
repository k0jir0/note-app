const { handleApiError } = require('../utils/errorHandler');
const breakGlassResearchService = require('../services/breakGlassResearchService');

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
        const overview = breakGlassResearchService.buildBreakGlassModuleOverview({
            baseUrl: resolveBaseUrl(req),
            breakGlass: req.breakGlassState || (req.app && req.app.locals ? req.app.locals.breakGlass : null),
            user: req.user || null
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get break-glass module overview');
    }
};
