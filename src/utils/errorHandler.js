/**
 * Centralized error handling utilities for consistent error responses
 */

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
        const errors = Object.values(error.errors).map(err => err.message);
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
            error: error.message
        });
    }

    // Duplicate key errors
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry',
            error: 'A resource with this information already exists'
        });
    }

    // Log the error for debugging
    console.error(`${operation} failed:`, error.message);

    // Default server error
    return res.status(500).json({
        success: false,
        message: 'Server Error',
        error: error.message
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
    // Log the error for debugging
    console.error(`${operation} failed:`, error.message);

    // For validation errors
    if (error.name === 'ValidationError') {
        const errorMessages = Object.values(error.errors).map(e => e.message);
        return res.status(400).send(`Validation Error: ${errorMessages.join('. ')}`);
    }

    // For cast errors (invalid ID format)
    if (error.name === 'CastError') {
        return res.status(400).send('Invalid request format. Please check your input.');
    }

    // Default server error
    return res.status(500).send(`Server Error: ${operation} failed. Please try again later.`);
};

module.exports = {
    handleApiError,
    handlePageError
};
