const { handleApiError } = require('../utils/errorHandler');
const hardwareFirstMfaResearchService = require('../services/hardwareFirstMfaResearchService');

const VALIDATION_ERROR_CODES = new Set([
    'UNKNOWN_MFA_METHOD',
    'FACTOR_UNAVAILABLE',
    'CHALLENGE_REQUIRED',
    'CHALLENGE_EXPIRED',
    'CHALLENGE_MISMATCH',
    'VERIFICATION_REQUIRED',
    'INVALID_HARDWARE_PROOF',
    'INVALID_CERTIFICATE_ASSERTION',
    'SESSION_UNAVAILABLE'
]);

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

function trimBodyString(req, key) {
    return typeof req.body?.[key] === 'string' ? req.body[key].trim() : '';
}

exports.getOverview = async (req, res) => {
    try {
        const overview = hardwareFirstMfaResearchService.buildHardwareFirstMfaModuleOverview({
            user: req.user,
            session: req.session,
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get hardware-first MFA overview');
    }
};

exports.issueChallenge = async (req, res) => {
    try {
        const method = trimBodyString(req, 'method');
        const errors = [];

        if (!method) {
            errors.push('method is required');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const challenge = hardwareFirstMfaResearchService.startHardwareFirstMfaChallenge({
            user: req.user,
            session: req.session,
            method
        });

        return res.status(200).json({
            success: true,
            data: challenge
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: [error.message]
            });
        }

        return handleApiError(res, error, 'Start hardware-first MFA challenge');
    }
};

exports.verifyChallenge = async (req, res) => {
    try {
        const method = trimBodyString(req, 'method');
        const challengeId = trimBodyString(req, 'challengeId');
        const responseValue = trimBodyString(req, 'responseValue');
        const errors = [];

        if (!method) {
            errors.push('method is required');
        }

        if (!challengeId) {
            errors.push('challengeId is required');
        }

        if (!responseValue) {
            errors.push('responseValue is required');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const sessionAssurance = hardwareFirstMfaResearchService.verifyHardwareFirstMfaStepUp({
            user: req.user,
            session: req.session,
            method,
            challengeId,
            responseValue
        });

        return res.status(200).json({
            success: true,
            data: sessionAssurance
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: [error.message]
            });
        }

        return handleApiError(res, error, 'Verify hardware-first MFA challenge');
    }
};

exports.revokeSession = async (req, res) => {
    try {
        const sessionAssurance = hardwareFirstMfaResearchService.revokeHardwareFirstMfaStepUp({
            session: req.session
        });

        return res.status(200).json({
            success: true,
            data: sessionAssurance
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: [error.message]
            });
        }

        return handleApiError(res, error, 'Revoke hardware-first MFA session');
    }
};
