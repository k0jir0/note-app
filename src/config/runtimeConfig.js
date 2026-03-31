const {
    DEFAULT_CIPHER_ALGO,
    IMMUTABLE_LOG_FORMATS,
    MIN_SESSION_SECRET_LENGTH,
    SUPPORTED_CIPHER_ALGOS,
    getActiveCipherSuite,
    getConfiguredAppBaseUrl,
    hasGoogleAuthCredentials,
    isNonEmptyString,
    isPlaceholderValue,
    normalizeAppBaseUrl,
    parseCipherAlgo,
    validateEncryptionKeyFormat
} = require('./runtime/helpers');
const {
    buildIntrusionBatchConfig,
    buildLogBatchConfig,
    buildScanBatchConfig
} = require('./runtime/automation');
const { buildSessionManagementConfig } = require('./runtime/sessionManagement');
const { buildTransportConfig } = require('./runtime/transport');
const { buildImmutableLoggingConfig } = require('./runtime/immutableLogging');
const { buildBreakGlassConfig } = require('./runtime/breakGlass');
const { toDiagnosticRuntimeConfig } = require('./runtime/diagnostics');

function validateRuntimeConfig(env = process.env) {
    const errors = [];
    const cipherAlgo = parseCipherAlgo(env, errors);
    const activeCipherSuite = getActiveCipherSuite(cipherAlgo);

    if (!isNonEmptyString(env.MONGODB_URI)) {
        errors.push('MONGODB_URI is required');
    } else if (isPlaceholderValue('MONGODB_URI', env.MONGODB_URI)) {
        errors.push('MONGODB_URI must be set to a real connection string');
    }

    if (!isNonEmptyString(env.SESSION_SECRET)) {
        errors.push('SESSION_SECRET is required');
    } else {
        const sessionSecret = env.SESSION_SECRET.trim();
        if (isPlaceholderValue('SESSION_SECRET', sessionSecret)) {
            errors.push('SESSION_SECRET must not use the example placeholder value');
        }
        if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
            errors.push(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long`);
        }
    }

    if (!isNonEmptyString(env.NOTE_ENCRYPTION_KEY)) {
        errors.push('NOTE_ENCRYPTION_KEY is required');
    } else if (isPlaceholderValue('NOTE_ENCRYPTION_KEY', env.NOTE_ENCRYPTION_KEY)) {
        errors.push('NOTE_ENCRYPTION_KEY must not use the example placeholder value');
    } else {
        validateEncryptionKeyFormat('NOTE_ENCRYPTION_KEY', env.NOTE_ENCRYPTION_KEY, activeCipherSuite, errors);
    }

    const hasGoogleClientId = isNonEmptyString(env.GOOGLE_CLIENT_ID);
    const hasGoogleClientSecret = isNonEmptyString(env.GOOGLE_CLIENT_SECRET);

    if (hasGoogleClientId !== hasGoogleClientSecret) {
        errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided together');
    }

    if (hasGoogleClientId && isPlaceholderValue('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID)) {
        errors.push('GOOGLE_CLIENT_ID must not use the example placeholder value');
    }

    if (hasGoogleClientSecret && isPlaceholderValue('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET)) {
        errors.push('GOOGLE_CLIENT_SECRET must not use the example placeholder value');
    }

    normalizeAppBaseUrl(env.APP_BASE_URL, errors);

    if (isNonEmptyString(env.LEGACY_NOTE_ENCRYPTION_KEY)) {
        if (isPlaceholderValue('LEGACY_NOTE_ENCRYPTION_KEY', env.LEGACY_NOTE_ENCRYPTION_KEY)) {
            errors.push('LEGACY_NOTE_ENCRYPTION_KEY must not use the example placeholder value');
        } else {
            validateEncryptionKeyFormat('LEGACY_NOTE_ENCRYPTION_KEY', env.LEGACY_NOTE_ENCRYPTION_KEY, activeCipherSuite, errors);
        }
    }

    if (env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK !== undefined
        && !['true', 'false'].includes(String(env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK).trim().toLowerCase())) {
        errors.push('ALLOW_LEGACY_SESSION_SECRET_FALLBACK must be either true or false when set');
    }

    const logBatch = buildLogBatchConfig(env, errors);
    const scanBatch = buildScanBatchConfig(env, errors);
    const intrusionBatch = buildIntrusionBatchConfig(env, errors);
    const sessionManagement = buildSessionManagementConfig(env, errors);
    const transport = buildTransportConfig(env, errors);
    const immutableLogging = buildImmutableLoggingConfig(env, errors);
    const breakGlass = buildBreakGlassConfig(env, errors);

    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    }

    return {
        dbURI: env.MONGODB_URI.trim(),
        sessionSecret: env.SESSION_SECRET.trim(),
        noteEncryptionKey: env.NOTE_ENCRYPTION_KEY.trim(),
        cipherAlgo,
        appBaseUrl: getConfiguredAppBaseUrl(env),
        googleAuthEnabled: hasGoogleAuthCredentials(env),
        sessionManagement,
        transport,
        immutableLogging,
        breakGlass,
        automation: {
            logBatch,
            scanBatch,
            intrusionBatch
        }
    };
}

module.exports = {
    DEFAULT_CIPHER_ALGO,
    IMMUTABLE_LOG_FORMATS,
    MIN_SESSION_SECRET_LENGTH,
    SUPPORTED_CIPHER_ALGOS,
    getConfiguredAppBaseUrl,
    hasGoogleAuthCredentials,
    toDiagnosticRuntimeConfig,
    validateRuntimeConfig
};
