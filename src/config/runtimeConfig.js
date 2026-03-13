const MIN_SESSION_SECRET_LENGTH = 32;
const ENCRYPTION_KEY_HEX_REGEX = /^[a-fA-F0-9]{64}$/;

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

    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    }

    return {
        dbURI: env.MONGODB_URI.trim(),
        sessionSecret: env.SESSION_SECRET.trim(),
        noteEncryptionKey: env.NOTE_ENCRYPTION_KEY.trim(),
        googleAuthEnabled: hasGoogleAuthCredentials(env)
    };
}

module.exports = {
    MIN_SESSION_SECRET_LENGTH,
    hasGoogleAuthCredentials,
    validateRuntimeConfig
};
