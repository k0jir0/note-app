// Validation utility functions

// Validation constants
const VALIDATION_LIMITS = {
    NOTE_TITLE_MIN: 3,
    NOTE_TITLE_MAX: 200,
    NOTE_CONTENT_MAX: 10000,
    NOTE_IMAGE_URL_MAX: 500,
    EMAIL_MAX: 254,
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 128
};

/**
 * Validate note data
 * @param {Object} data - Note data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateNoteData = (data, isUpdate = false) => {
    const errors = [];

    // Title validation
    if (!isUpdate || data.title !== undefined) {
        if (!data.title || typeof data.title !== 'string') {
            errors.push('Title is required and must be a string');
        } else if (data.title.trim().length === 0) {
            errors.push('Title cannot be empty or only whitespace');
        } else if (data.title.length > VALIDATION_LIMITS.NOTE_TITLE_MAX) {
            errors.push(`Title must be ${VALIDATION_LIMITS.NOTE_TITLE_MAX} characters or less`);
        } else if (data.title.length < VALIDATION_LIMITS.NOTE_TITLE_MIN) {
            errors.push(`Title must be at least ${VALIDATION_LIMITS.NOTE_TITLE_MIN} characters long`);
        }
    }

    // Content validation
    if (data.content !== undefined) {
        if (typeof data.content !== 'string') {
            errors.push('Content must be a string');
        } else if (data.content.length > VALIDATION_LIMITS.NOTE_CONTENT_MAX) {
            errors.push(`Content must be ${VALIDATION_LIMITS.NOTE_CONTENT_MAX.toLocaleString()} characters or less`);
        }
    }

    // Image URL validation
    if (data.image !== undefined && data.image !== '') {
        if (typeof data.image !== 'string') {
            errors.push('Image URL must be a string');
        } else if (!isValidUrl(data.image)) {
            errors.push('Image must be a valid URL (http:// or https://)');
        } else if (data.image.length > VALIDATION_LIMITS.NOTE_IMAGE_URL_MAX) {
            errors.push(`Image URL must be ${VALIDATION_LIMITS.NOTE_IMAGE_URL_MAX} characters or less`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
const isValidUrl = (url) => {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
        return false;
    }
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0) {
        return { isValid: false, error: 'Email cannot be empty' };
    }

    if (trimmedEmail.length > VALIDATION_LIMITS.EMAIL_MAX) {
        return { isValid: false, error: 'Email is too long' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        return { isValid: false, error: 'Please enter a valid email address (e.g., user@example.com)' };
    }

    return { isValid: true, error: null };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validatePassword = (password) => {
    const errors = [];

    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
        return { isValid: false, errors };
    }

    if (password.length < VALIDATION_LIMITS.PASSWORD_MIN) {
        errors.push(`Password must be at least ${VALIDATION_LIMITS.PASSWORD_MIN} characters long`);
    }

    if (password.length > VALIDATION_LIMITS.PASSWORD_MAX) {
        errors.push(`Password must be ${VALIDATION_LIMITS.PASSWORD_MAX} characters or less`);
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Sanitize string input to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;

    // Remove any HTML tags and trim whitespace
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
};

/**
 * Sanitize note data
 * @param {Object} data - Note data to sanitize
 * @returns {Object} Sanitized note data
 */
const sanitizeNoteData = (data) => {
    const sanitized = {};

    if (data.title !== undefined) {
        sanitized.title = sanitizeString(data.title);
    }

    if (data.content !== undefined) {
        sanitized.content = typeof data.content === 'string' ? data.content.trim() : data.content;
    }

    if (data.image !== undefined) {
        sanitized.image = typeof data.image === 'string' ? data.image.trim() : data.image;
    }

    return sanitized;
};

module.exports = {
    validateNoteData,
    validateEmail,
    validatePassword,
    sanitizeString,
    sanitizeNoteData,
    isValidUrl,
    VALIDATION_LIMITS
};
