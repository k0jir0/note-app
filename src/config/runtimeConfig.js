const MIN_SESSION_SECRET_LENGTH = 32;
const ENCRYPTION_KEY_HEX_REGEX = /^[a-fA-F0-9]{64}$/;
const MONGODB_OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_AUTOMATION_INTERVAL_MS = 1000 * 60 * 60 * 24;

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

function validateEncryptionKeyFormat(name, rawValue, errors) {
    const trimmedValue = rawValue.trim();

    if (ENCRYPTION_KEY_HEX_REGEX.test(trimmedValue)) {
        return;
    }

    const decoded = Buffer.from(trimmedValue, 'base64');
    if (decoded.length === 32) {
        return;
    }

    errors.push(`${name} must be a 64-character hex string or base64 for 32 bytes`);
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

function buildLogBatchConfig(env, errors) {
    const enabled = parseBooleanEnv('LOG_BATCH_ENABLED', env, errors);

    if (!enabled) {
        return { enabled: false };
    }

    const filePath = isNonEmptyString(env.LOG_BATCH_FILE_PATH) ? env.LOG_BATCH_FILE_PATH.trim() : '';
    if (!filePath) {
        errors.push('LOG_BATCH_FILE_PATH is required when LOG_BATCH_ENABLED=true');
    }

    return {
        enabled: true,
        filePath,
        userId: validateUserId('LOG_BATCH_USER_ID', env.LOG_BATCH_USER_ID, errors),
        source: isNonEmptyString(env.LOG_BATCH_SOURCE) ? env.LOG_BATCH_SOURCE.trim() : 'server-log-batch',
        intervalMs: parseIntegerEnv('LOG_BATCH_INTERVAL_MS', env, {
            defaultValue: 60000,
            min: 5000,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors),
        maxReadBytes: parseIntegerEnv('LOG_BATCH_MAX_READ_BYTES', env, {
            defaultValue: 65536,
            min: 4096,
            max: 500000
        }, errors),
        dedupeWindowMs: parseIntegerEnv('LOG_BATCH_DEDUPE_WINDOW_MS', env, {
            defaultValue: 300000,
            min: 0,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors)
    };
}

function buildScanBatchConfig(env, errors) {
    const enabled = parseBooleanEnv('SCAN_BATCH_ENABLED', env, errors);

    if (!enabled) {
        return { enabled: false };
    }

    const filePath = isNonEmptyString(env.SCAN_BATCH_FILE_PATH) ? env.SCAN_BATCH_FILE_PATH.trim() : '';
    if (!filePath) {
        errors.push('SCAN_BATCH_FILE_PATH is required when SCAN_BATCH_ENABLED=true');
    }

    return {
        enabled: true,
        filePath,
        userId: validateUserId('SCAN_BATCH_USER_ID', env.SCAN_BATCH_USER_ID, errors),
        source: isNonEmptyString(env.SCAN_BATCH_SOURCE) ? env.SCAN_BATCH_SOURCE.trim() : 'scheduled-scan-import',
        intervalMs: parseIntegerEnv('SCAN_BATCH_INTERVAL_MS', env, {
            defaultValue: 300000,
            min: 5000,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors),
        dedupeWindowMs: parseIntegerEnv('SCAN_BATCH_DEDUPE_WINDOW_MS', env, {
            defaultValue: 3600000,
            min: 0,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors)
    };
}

function buildIntrusionBatchConfig(env, errors) {
    const enabled = parseBooleanEnv('INTRUSION_BATCH_ENABLED', env, errors);

    if (!enabled) {
        return { enabled: false };
    }

    const filePath = isNonEmptyString(env.INTRUSION_BATCH_FILE_PATH) ? env.INTRUSION_BATCH_FILE_PATH.trim() : '';
    if (!filePath) {
        errors.push('INTRUSION_BATCH_FILE_PATH is required when INTRUSION_BATCH_ENABLED=true');
    }

    return {
        enabled: true,
        filePath,
        userId: validateUserId('INTRUSION_BATCH_USER_ID', env.INTRUSION_BATCH_USER_ID, errors),
        source: isNonEmptyString(env.INTRUSION_BATCH_SOURCE) ? env.INTRUSION_BATCH_SOURCE.trim() : 'intrusion-runner',
        intervalMs: parseIntegerEnv('INTRUSION_BATCH_INTERVAL_MS', env, {
            defaultValue: 5000,
            min: 1000,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors),
        dedupeWindowMs: parseIntegerEnv('INTRUSION_BATCH_DEDUPE_WINDOW_MS', env, {
            defaultValue: 300000,
            min: 0,
            max: MAX_AUTOMATION_INTERVAL_MS
        }, errors)
    };
}

function buildAutomationDiagnostics(config = {}) {
    return {
        enabled: Boolean(config && config.enabled),
        source: isNonEmptyString(config && config.source) ? config.source.trim() : '',
        intervalMs: Number.isFinite(config && config.intervalMs) ? config.intervalMs : null,
        dedupeWindowMs: Number.isFinite(config && config.dedupeWindowMs) ? config.dedupeWindowMs : null,
        maxReadBytes: Number.isFinite(config && config.maxReadBytes) ? config.maxReadBytes : null,
        fileConfigured: isNonEmptyString(config && config.filePath),
        userConfigured: isNonEmptyString(config && config.userId)
    };
}

function toDiagnosticRuntimeConfig(runtimeConfig) {
    if (!runtimeConfig || typeof runtimeConfig !== 'object') {
        return null;
    }

    const automation = runtimeConfig.automation || {};

    return {
        dbConfigured: isNonEmptyString(runtimeConfig.dbURI),
        sessionSecretConfigured: isNonEmptyString(runtimeConfig.sessionSecret),
        noteEncryptionConfigured: isNonEmptyString(runtimeConfig.noteEncryptionKey),
        appBaseUrl: isNonEmptyString(runtimeConfig.appBaseUrl) ? runtimeConfig.appBaseUrl.trim() : '',
        googleAuthEnabled: Boolean(runtimeConfig.googleAuthEnabled),
        automation: {
            logBatch: buildAutomationDiagnostics(automation.logBatch),
            scanBatch: buildAutomationDiagnostics(automation.scanBatch),
            intrusionBatch: buildAutomationDiagnostics(automation.intrusionBatch)
        }
    };
}

function validateRuntimeConfig(env = process.env) {
    const errors = [];

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
        validateEncryptionKeyFormat('NOTE_ENCRYPTION_KEY', env.NOTE_ENCRYPTION_KEY, errors);
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
            validateEncryptionKeyFormat('LEGACY_NOTE_ENCRYPTION_KEY', env.LEGACY_NOTE_ENCRYPTION_KEY, errors);
        }
    }

    if (env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK !== undefined
        && !['true', 'false'].includes(String(env.ALLOW_LEGACY_SESSION_SECRET_FALLBACK).trim().toLowerCase())) {
        errors.push('ALLOW_LEGACY_SESSION_SECRET_FALLBACK must be either true or false when set');
    }

    const logBatch = buildLogBatchConfig(env, errors);
    const scanBatch = buildScanBatchConfig(env, errors);
    const intrusionBatch = buildIntrusionBatchConfig(env, errors);

    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    }

    return {
        dbURI: env.MONGODB_URI.trim(),
        sessionSecret: env.SESSION_SECRET.trim(),
        noteEncryptionKey: env.NOTE_ENCRYPTION_KEY.trim(),
        appBaseUrl: getConfiguredAppBaseUrl(env),
        googleAuthEnabled: hasGoogleAuthCredentials(env),
        automation: {
            logBatch,
            scanBatch,
            intrusionBatch
        }
    };
}

module.exports = {
    MIN_SESSION_SECRET_LENGTH,
    getConfiguredAppBaseUrl,
    hasGoogleAuthCredentials,
    toDiagnosticRuntimeConfig,
    validateRuntimeConfig
};
