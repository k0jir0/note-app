const { handleApiError } = require('../utils/errorHandler');
const hardwareFirstMfaResearchService = require('../services/hardwareFirstMfaResearchService');
const { extractClientCertificateEvidence } = require('../services/hardwareFirstMfaService');
const { sanitizeClientErrorList } = require('../utils/metadataSanitization');

const VALIDATION_ERROR_CODES = new Set([
    'UNKNOWN_MFA_METHOD',
    'FACTOR_UNAVAILABLE',
    'CHALLENGE_REQUIRED',
    'CHALLENGE_EXPIRED',
    'CHALLENGE_MISMATCH',
    'REGISTRATION_REQUIRED',
    'REGISTRATION_EXPIRED',
    'VERIFICATION_REQUIRED',
    'INVALID_HARDWARE_PROOF',
    'INVALID_CERTIFICATE_ASSERTION',
    'SESSION_UNAVAILABLE',
    'WEBAUTHN_REQUIRED',
    'WEBAUTHN_INVALID_CLIENT_DATA',
    'WEBAUTHN_CHALLENGE_MISMATCH',
    'WEBAUTHN_INVALID_TYPE',
    'WEBAUTHN_ORIGIN_MISMATCH',
    'WEBAUTHN_INVALID_AUTH_DATA',
    'WEBAUTHN_RP_MISMATCH',
    'WEBAUTHN_USER_PRESENCE_REQUIRED',
    'WEBAUTHN_CREDENTIAL_REQUIRED',
    'WEBAUTHN_REGISTRATION_INCOMPLETE',
    'WEBAUTHN_NO_CREDENTIALS',
    'WEBAUTHN_UNKNOWN_CREDENTIAL',
    'WEBAUTHN_ASSERTION_INCOMPLETE',
    'WEBAUTHN_INVALID_SIGNATURE',
    'WEBAUTHN_COUNTER_REGRESSION',
    'PKI_CLIENT_CERT_REQUIRED'
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
            baseUrl: resolveBaseUrl(req),
            transportSecurity: req.app && req.app.locals ? req.app.locals.transportSecurity : null
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
            method,
            baseUrl: resolveBaseUrl(req)
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
                errors: sanitizeClientErrorList([error.message], 'The submitted MFA request is invalid.')
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
        const assertion = req.body?.assertion || null;
        const errors = [];

        if (!method) {
            errors.push('method is required');
        }

        if (!challengeId) {
            errors.push('challengeId is required');
        }

        if (!responseValue && !assertion && method !== 'pki_certificate') {
            errors.push('responseValue is required');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const sessionAssurance = await hardwareFirstMfaResearchService.verifyHardwareFirstMfaStepUp({
            user: req.user,
            session: req.session,
            method,
            challengeId,
            responseValue,
            assertion,
            requestEvidence: extractClientCertificateEvidence(req)
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
                errors: sanitizeClientErrorList([error.message], 'The submitted MFA request is invalid.')
            });
        }

        return handleApiError(res, error, 'Verify hardware-first MFA challenge');
    }
};

exports.issueRegistrationOptions = async (req, res) => {
    try {
        const registration = hardwareFirstMfaResearchService.startHardwareTokenRegistration({
            user: req.user,
            session: req.session,
            baseUrl: resolveBaseUrl(req)
        });

        return res.status(200).json({
            success: true,
            data: registration
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: sanitizeClientErrorList([error.message], 'The registration request is invalid.')
            });
        }

        return handleApiError(res, error, 'Issue hardware-token registration options');
    }
};

exports.verifyRegistration = async (req, res) => {
    try {
        const registrationResponse = req.body?.registrationResponse || null;
        if (!registrationResponse) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['registrationResponse is required']
            });
        }

        const result = await hardwareFirstMfaResearchService.verifyHardwareTokenRegistrationFlow({
            user: req.user,
            session: req.session,
            registrationResponse
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: sanitizeClientErrorList([error.message], 'The registration response is invalid.')
            });
        }

        return handleApiError(res, error, 'Verify hardware-token registration');
    }
};

exports.registerCurrentPkiCertificate = async (req, res) => {
    try {
        const result = await hardwareFirstMfaResearchService.registerCurrentPkiCertificateForUser({
            user: req.user,
            requestEvidence: extractClientCertificateEvidence(req)
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        if (error && VALIDATION_ERROR_CODES.has(error.code)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: sanitizeClientErrorList([error.message], 'The certificate registration request is invalid.')
            });
        }

        return handleApiError(res, error, 'Register current PKI certificate');
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
                errors: sanitizeClientErrorList([error.message], 'The session revocation request is invalid.')
            });
        }

        return handleApiError(res, error, 'Revoke hardware-first MFA session');
    }
};
