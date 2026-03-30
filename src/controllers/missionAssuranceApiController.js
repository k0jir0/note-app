const { handleApiError } = require('../utils/errorHandler');
const missionAssuranceResearchService = require('../services/missionAssuranceResearchService');
const { isValidNetworkZone } = require('../services/missionAccessControlService');
const { sanitizeClientErrorList } = require('../utils/metadataSanitization');

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
        const overview = missionAssuranceResearchService.buildMissionAssuranceModuleOverview({
            user: req.user,
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get mission assurance module overview');
    }
};

exports.evaluateDecision = async (req, res) => {
    try {
        const actionId = typeof req.body?.actionId === 'string' ? req.body.actionId.trim() : '';
        const resourceId = typeof req.body?.resourceId === 'string' ? req.body.resourceId.trim() : '';
        const personaId = typeof req.body?.personaId === 'string' ? req.body.personaId.trim() : 'current-user';
        const networkZone = typeof req.body?.context?.networkZone === 'string'
            ? req.body.context.networkZone.trim().toLowerCase()
            : '';
        const justification = typeof req.body?.context?.justification === 'string'
            ? req.body.context.justification.trim()
            : '';
        const errors = [];

        if (!actionId) {
            errors.push('actionId is required');
        }

        if (!resourceId) {
            errors.push('resourceId is required');
        }

        if (networkZone && !isValidNetworkZone(networkZone)) {
            errors.push('context.networkZone must be one of public, corp, or mission');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const result = missionAssuranceResearchService.evaluateMissionAssuranceScenario({
            user: req.user,
            personaId,
            actionId,
            resourceId,
            contextOverrides: {
                networkZone,
                justification
            }
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        if (error && (error.code === 'UNKNOWN_ACTION' || error.code === 'UNKNOWN_RESOURCE' || error.code === 'UNKNOWN_PERSONA')) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: sanitizeClientErrorList([error.message], 'The requested mission assurance scenario is invalid.')
            });
        }

        return handleApiError(res, error, 'Evaluate mission assurance decision');
    }
};
