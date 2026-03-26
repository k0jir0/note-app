const { handleApiError } = require('../utils/errorHandler');
const sessionManagementResearchService = require('../services/sessionManagementResearchService');

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

function parseOptionalNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

exports.getOverview = async (req, res) => {
    try {
        const overview = sessionManagementResearchService.buildSessionManagementModuleOverview({
            user: req.user,
            session: req.session,
            runtimeConfig: req.app && req.app.locals ? req.app.locals.runtimeConfig : {},
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get session management module overview');
    }
};

exports.evaluateScenario = async (req, res) => {
    try {
        const scenarioId = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId.trim() : '';
        const idleMinutes = parseOptionalNumber(req.body?.idleMinutes);
        const elapsedHours = parseOptionalNumber(req.body?.elapsedHours);
        const networkZone = typeof req.body?.networkZone === 'string' ? req.body.networkZone.trim().toLowerCase() : '';
        const concurrentLoginDetected = req.body?.concurrentLoginDetected;
        const errors = [];

        if (Number.isNaN(idleMinutes)) {
            errors.push('idleMinutes must be numeric when provided');
        }

        if (Number.isNaN(elapsedHours)) {
            errors.push('elapsedHours must be numeric when provided');
        }

        if (networkZone && !['public', 'corp', 'mission'].includes(networkZone)) {
            errors.push('networkZone must be one of public, corp, or mission');
        }

        if (concurrentLoginDetected !== undefined && typeof concurrentLoginDetected !== 'boolean') {
            errors.push('concurrentLoginDetected must be boolean when provided');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const evaluation = sessionManagementResearchService.evaluateSessionLockdownScenario({
            user: req.user,
            session: req.session,
            runtimeConfig: req.app && req.app.locals ? req.app.locals.runtimeConfig : {},
            scenarioId,
            idleMinutes: idleMinutes === null ? undefined : idleMinutes,
            elapsedHours: elapsedHours === null ? undefined : elapsedHours,
            networkZone,
            concurrentLoginDetected
        });

        return res.status(200).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        return handleApiError(res, error, 'Evaluate session management scenario');
    }
};
