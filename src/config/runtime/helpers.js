const {
    DEFAULT_CIPHER_ALGO,
    getCryptoSuite,
    listSupportedCipherAlgos,
    normalizeCipherAlgo
} = require('../../utils/cryptoSuite');

const MIN_SESSION_SECRET_LENGTH = 32;
const MONGODB_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_AUTOMATION_INTERVAL_MS = 1000 * 60 * 60 * 24;
const MAX_IMMUTABLE_LOG_TIMEOUT_MS = 1000 * 30;
const IMMUTABLE_LOG_FORMATS = ['json', 'syslog'];
const VALID_BREAK_GLASS_MODES = ['disabled', 'read_only', 'offline'];
const SUPPORTED_CIPHER_ALGOS = listSupportedCipherAlgos();

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPlaceholderValue(name, value) {
    if (!isNonEmptyString(value)) {
        return false;
    }

    const normalizedValue = value.trim().toLowerCase();
    const placeholderChecks = {
        MONGODB_URI: () => normalizedValue.includes('<your-mongodb-connection-string>'),
        SESSION_SECRET: () => normalizedValue.includes('yoursecretkeyhere')
            || normalizedValue.includes('changethisinproduction')
            || normalizedValue.includes('strong-random-secret'),
        NOTE_ENCRYPTION_KEY: () => normalizedValue.includes('<your-32-byte-key>')
            || normalizedValue.includes('your_note_encryption_key')
            || normalizedValue.includes('your-32-byte-key'),
        GOOGLE_CLIENT_ID: () => normalizedValue === 'your_google_client_id'
            || normalizedValue === 'your-google-client-id',
        GOOGLE_CLIENT_SECRET: () => normalizedValue === 'your_google_client_secret'
            || normalizedValue === 'your-google-client-secret',
        LEGACY_NOTE_ENCRYPTION_KEY: () => normalizedValue.includes('<previous-32-byte-key>')
    };

    return placeholderChecks[name] ? placeholderChecks[name]() : false;
}

function validateEncryptionKeyFormat(name, rawValue, suite, errors) {
    const trimmedValue = rawValue.trim();
    const keyLengthBytes = suite && Number.isInteger(suite.keyLengthBytes) ? suite.keyLengthBytes : 32;
    const hexRegex = new RegExp(`^[a-fA-F0-9]{${keyLengthBytes * 2}}$`);

    if (hexRegex.test(trimmedValue)) {
        return;
    }

    const decoded = Buffer.from(trimmedValue, 'base64');
    if (decoded.length === keyLengthBytes) {
        return;
    }

    errors.push(`${name} must be a ${keyLengthBytes * 2}-character hex string or base64 for ${keyLengthBytes} bytes`);
}

function parseCipherAlgo(env = process.env, errors = []) {
    const normalized = normalizeCipherAlgo(env.CIPHER_ALGO || DEFAULT_CIPHER_ALGO) || DEFAULT_CIPHER_ALGO;
    if (!SUPPORTED_CIPHER_ALGOS.includes(normalized)) {
        errors.push(`CIPHER_ALGO must be one of: ${SUPPORTED_CIPHER_ALGOS.join(', ')}`);
        return DEFAULT_CIPHER_ALGO;
    }

    return normalized;
}

function getActiveCipherSuite(cipherAlgo) {
    return getCryptoSuite(cipherAlgo);
}

function hasGoogleAuthCredentials(env = process.env) {
    return isNonEmptyString(env.GOOGLE_CLIENT_ID) && isNonEmptyString(env.GOOGLE_CLIENT_SECRET);
}

function normalizeAppBaseUrl(rawValue, errors) {
    if (!isNonEmptyString(rawValue)) {
        return '';
    }

    try {
        const parsed = new URL(rawValue.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Invalid protocol');
        }

        const normalizedPath = parsed.pathname && parsed.pathname !== '/'
            ? parsed.pathname.replace(/\/+$/, '')
            : '';
        return `${parsed.origin}${normalizedPath}`;
    } catch (_error) {
        if (Array.isArray(errors)) {
            errors.push('APP_BASE_URL must be a valid http or https URL when set');
        }
        return '';
    }
}

function getConfiguredAppBaseUrl(env = process.env) {
    return normalizeAppBaseUrl(env.APP_BASE_URL);
}

function parseBooleanEnv(name, env, errors) {
    const rawValue = env[name];

    if (rawValue === undefined) {
        return false;
    }

    const normalizedValue = String(rawValue).trim().toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }

    if (normalizedValue === 'false') {
        return false;
    }

    errors.push(`${name} must be either true or false when set`);
    return false;
}

function parseIntegerEnv(name, env, options, errors) {
    const { defaultValue, min, max } = options;
    const rawValue = env[name];

    if (rawValue === undefined || String(rawValue).trim() === '') {
        return defaultValue;
    }

    const parsedValue = Number.parseInt(String(rawValue).trim(), 10);
    if (Number.isNaN(parsedValue)) {
        errors.push(`${name} must be an integer`);
        return defaultValue;
    }

    if (parsedValue < min || parsedValue > max) {
        errors.push(`${name} must be between ${min} and ${max}`);
        return defaultValue;
    }

    return parsedValue;
}

function validateUserId(name, value, errors) {
    if (!isNonEmptyString(value)) {
        errors.push(`${name} is required when the matching batch automation is enabled`);
        return '';
    }

    const trimmedValue = value.trim();
    if (!MONGODB_OBJECT_ID_REGEX.test(trimmedValue)) {
        errors.push(`${name} must be a valid MongoDB ObjectId`);
        return '';
    }

    return trimmedValue;
}

module.exports = {
    DEFAULT_CIPHER_ALGO,
    IMMUTABLE_LOG_FORMATS,
    MAX_AUTOMATION_INTERVAL_MS,
    MAX_IMMUTABLE_LOG_TIMEOUT_MS,
    MIN_SESSION_SECRET_LENGTH,
    SUPPORTED_CIPHER_ALGOS,
    VALID_BREAK_GLASS_MODES,
    getActiveCipherSuite,
    getConfiguredAppBaseUrl,
    hasGoogleAuthCredentials,
    isNonEmptyString,
    isPlaceholderValue,
    normalizeAppBaseUrl,
    parseBooleanEnv,
    parseCipherAlgo,
    parseIntegerEnv,
    validateEncryptionKeyFormat,
    validateUserId
};
