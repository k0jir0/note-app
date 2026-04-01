const {
    MAX_AUTOMATION_INTERVAL_MS,
    isNonEmptyString,
    parseBooleanEnv,
    parseIntegerEnv,
    validateUserId
} = require('./helpers');

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

module.exports = {
    buildAutomationDiagnostics,
    buildIntrusionBatchConfig,
    buildLogBatchConfig,
    buildScanBatchConfig
};
