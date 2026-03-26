const { handleApiError } = require('../utils/errorHandler');
const accessControlResearchService = require('../services/accessControlResearchService');

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
        const overview = accessControlResearchService.buildAccessControlModuleOverview({
            baseUrl: resolveBaseUrl(req),
            user: req.user || null
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get access control module overview');
    }
};

exports.evaluateScenario = async (req, res) => {
    try {
        const errors = [];
        const body = req.body || {};
        const booleanFields = ['authenticated', 'serverIdentityVerified', 'ownsResource', 'frontendVisible'];

        booleanFields.forEach((field) => {
            if (body[field] !== undefined && typeof body[field] !== 'boolean') {
                errors.push(`${field} must be a boolean when provided`);
            }
        });

        if (body.missionRole !== undefined && typeof body.missionRole !== 'string') {
            errors.push('missionRole must be a string when provided');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const evaluation = accessControlResearchService.evaluateAccessControlScenario({
            scenarioId: typeof body.scenarioId === 'string' ? body.scenarioId.trim() : '',
            authenticated: body.authenticated,
            serverIdentityVerified: body.serverIdentityVerified,
            ownsResource: body.ownsResource,
            missionRole: body.missionRole,
            frontendVisible: body.frontendVisible
        });

        return res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        return handleApiError(res, error, 'Evaluate access control scenario');
    }
};
