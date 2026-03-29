const SENSITIVE_RESPONSE_HEADERS = [
    'Server',
    'X-Powered-By',
    'X-AspNet-Version',
    'X-AspNetMvc-Version'
];

const UNSAFE_ERROR_PATTERNS = [
    /\b(?:apache|nginx|iis|express|node(?:\.js)?|mongodb|mongoservererror|openssl)\b(?:[/ ]\S+)?/i,
    /\bat\s+[^\n]+\([^\n]+\)/i,
    /\b[a-z]:\\[^\s]+/i,
    /(?:^|\s)\/[^\s]+\/[^\s]*/,
    /\b(?:eaddrinuse|econnrefused|enoent|tlsv1(?:\.\d)?|sslv\d)\b/i,
    /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/
];

function stripSensitiveResponseHeaders(res) {
    if (!res || typeof res.removeHeader !== 'function') {
        return;
    }

    SENSITIVE_RESPONSE_HEADERS.forEach((headerName) => {
        res.removeHeader(headerName);
    });
}

function normalizeErrorText(message) {
    return String(message || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeClientErrorMessage(message, fallback = 'Request could not be completed.') {
    const normalized = normalizeErrorText(message);
    if (!normalized) {
        return fallback;
    }

    if (UNSAFE_ERROR_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return fallback;
    }

    return normalized;
}

function sanitizeClientErrorList(errors, fallback = 'Request could not be completed.') {
    const values = Array.isArray(errors) ? errors : [errors];
    const sanitized = values
        .map((value) => sanitizeClientErrorMessage(value, fallback))
        .filter(Boolean);

    return sanitized.length > 0 ? sanitized : [fallback];
}

module.exports = {
    SENSITIVE_RESPONSE_HEADERS,
    sanitizeClientErrorList,
    sanitizeClientErrorMessage,
    stripSensitiveResponseHeaders
};