const {
    IMMUTABLE_LOG_FORMATS,
    MAX_IMMUTABLE_LOG_TIMEOUT_MS,
    isNonEmptyString,
    parseBooleanEnv,
    parseIntegerEnv
} = require('./helpers');
const { buildRuntimePosture } = require('./database');

function buildImmutableLoggingConfig(env, errors) {
    const enabled = parseBooleanEnv('IMMUTABLE_LOGGING_ENABLED', env, errors);
    const required = buildRuntimePosture(env).protectedRuntime;
    const timeoutMs = parseIntegerEnv('IMMUTABLE_LOGGING_TIMEOUT_MS', env, {
        defaultValue: 2000,
        min: 250,
        max: MAX_IMMUTABLE_LOG_TIMEOUT_MS
    }, errors);
    const endpoint = isNonEmptyString(env.IMMUTABLE_LOGGING_URL) ? env.IMMUTABLE_LOGGING_URL.trim() : '';
    const token = isNonEmptyString(env.IMMUTABLE_LOGGING_TOKEN) ? env.IMMUTABLE_LOGGING_TOKEN.trim() : '';
    const source = isNonEmptyString(env.IMMUTABLE_LOGGING_SOURCE) ? env.IMMUTABLE_LOGGING_SOURCE.trim() : 'helios';
    const format = isNonEmptyString(env.IMMUTABLE_LOGGING_FORMAT) ? env.IMMUTABLE_LOGGING_FORMAT.trim().toLowerCase() : 'json';

    if (!IMMUTABLE_LOG_FORMATS.includes(format)) {
        errors.push(`IMMUTABLE_LOGGING_FORMAT must be one of: ${IMMUTABLE_LOG_FORMATS.join(', ')}`);
    }

    if (required && !enabled) {
        errors.push('IMMUTABLE_LOGGING_ENABLED must be true outside local development and test environments');
    }

    if (!enabled) {
        return {
            enabled: false,
            required,
            endpoint: '',
            token: '',
            timeoutMs,
            source,
            format: IMMUTABLE_LOG_FORMATS.includes(format) ? format : 'json',
            requireForwardSuccess: required
        };
    }

    if (!endpoint) {
        errors.push('IMMUTABLE_LOGGING_URL is required when IMMUTABLE_LOGGING_ENABLED=true');
    } else {
        try {
            const parsed = new URL(endpoint);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('Invalid protocol');
            }

            if (required && parsed.protocol !== 'https:') {
                errors.push('IMMUTABLE_LOGGING_URL must use https when immutable logging is required');
            }
        } catch (_error) {
            errors.push('IMMUTABLE_LOGGING_URL must be a valid http or https URL when immutable logging is enabled');
        }
    }

    if (!token) {
        errors.push('IMMUTABLE_LOGGING_TOKEN is required when IMMUTABLE_LOGGING_ENABLED=true');
    }

    return {
        enabled: true,
        required,
        endpoint,
        token,
        timeoutMs,
        source,
        format,
        requireForwardSuccess: required
    };
}

module.exports = {
    buildImmutableLoggingConfig
};
