/**
 * Centralized error handling utilities for consistent error responses
 */

const {
    sanitizeClientErrorList,
    sanitizeClientErrorMessage
} = require('./metadataSanitization');

function logError(operation, error) {
    console.error(`${operation} failed:`, error);
}

function deriveHttpStatus(error, fallback = 500) {
    const status = Number(error && (error.statusCode || error.status));
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
        return status;
    }

    return fallback;
}

function isApiRequest(req = {}) {
    const path = String(req.originalUrl || req.path || '');
    const acceptHeader = String(req.headers && req.headers.accept ? req.headers.accept : '');
    return path.startsWith('/api/') || acceptHeader.includes('application/json');
}

function handleAuthFailure(res, options = {}) {
    const {
        api = true,
        pageTitle = 'Login',
        pageError = 'Authentication is temporarily unavailable. Please try again.',
        statusCode = 401,
        redirectPath = '/auth/login',
        csrfToken = undefined,
        errors = ['Authentication could not be completed. Please try again.']
    } = options;

    if (api) {
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 403 ? 'Forbidden' : 'Unauthorized',
            errors: sanitizeClientErrorList(errors, 'Authentication could not be completed.')
        });
    }

    if (typeof res.render === 'function') {
        return res.status(statusCode).render('pages/login', {
            title: pageTitle,
            error: pageError,
            csrfToken
        });
    }

    if (typeof res.redirect === 'function') {
        return res.redirect(redirectPath);
    }

    return res.status(statusCode).send(pageError);
}

/**
 * Handle API errors with JSON response
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} operation - Description of the operation that failed
 * @returns {Object} JSON response
 */
const handleApiError = (res, error, operation = 'Operation') => {
    // Validation errors (missing required fields, invalid data types)
    if (error.name === 'ValidationError') {
        const errors = sanitizeClientErrorList(Object.values(error.errors).map((err) => err.message), 'Invalid input.');
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    // Cast errors (invalid data format)
    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid data format',
            errors: ['The request included an invalid identifier or value.']
        });
    }

    // Duplicate key errors
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry',
            errors: ['A resource with this information already exists']
        });
    }

    logError(operation, error);
    const status = deriveHttpStatus(error);
    const errors = status >= 500
        ? ['An unexpected error occurred. Please try again later.']
        : sanitizeClientErrorList(error && error.message ? [error.message] : [], 'Request could not be completed.');

    // Default server error
    return res.status(status).json({
        success: false,
        message: status >= 500 ? 'Server Error' : 'Request failed',
        errors
    });
};

/**
 * Handle page rendering errors with user-friendly messages
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} operation - Description of the operation that failed
 * @returns {Object} Rendered error page or redirect
 */
const handlePageError = (res, error, operation = 'Operation') => {
    logError(operation, error);

    // For validation errors
    if (error.name === 'ValidationError') {
        const errorMessages = sanitizeClientErrorList(Object.values(error.errors).map((entry) => entry.message), 'Invalid input.');
        return res.status(400).send(`Validation Error: ${errorMessages.join('. ')}`);
    }

    // For cast errors (invalid ID format)
    if (error.name === 'CastError') {
        return res.status(400).send('Invalid request format. Please check your input.');
    }

    const status = deriveHttpStatus(error);
    if (status < 500) {
        return res.status(status).send(sanitizeClientErrorMessage(error && error.message, 'Request could not be completed.'));
    }

    const safeOperation = sanitizeClientErrorMessage(operation, 'The request could not be completed');
    return res.status(500).send(`Server Error: ${safeOperation}. Please try again later.`);
};

const handleUnhandledError = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (isApiRequest(req)) {
        return handleApiError(res, error, 'Request');
    }

    return handlePageError(res, error, 'Request');
};

module.exports = {
    handleAuthFailure,
    handleApiError,
    handlePageError,
    handleUnhandledError
};
