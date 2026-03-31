const crypto = require('crypto');
const os = require('os');

const { enrichMetadataWithRequestContext } = require('./semanticLogging');

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_SOURCE = 'note-app';
const DEFAULT_FORMAT = 'json';
const CONSOLE_LEVEL_MAP = {
    log: 'info',
    info: 'info',
    warn: 'warn',
    error: 'error'
};
const SYSLOG_LEVEL_MAP = {
    error: 3,
    warn: 4,
    audit: 5,
    info: 6
};
const SYSLOG_FACILITY = 16;

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function truncateString(value, maxLength = 4000) {
    const normalized = String(value);
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength - 3)}...`
        : normalized;
}

function serializeLogValue(value, depth = 0) {
    if (value instanceof Error) {
        return {
            name: value.name || 'Error',
            message: truncateString(value.message || String(value)),
            stack: isNonEmptyString(value.stack) ? truncateString(value.stack, 8000) : ''
        };
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.slice(0, 20).map((entry) => serializeLogValue(entry, depth + 1));
    }

    if (value && typeof value === 'object') {
        if (depth >= 4) {
            return '[truncated-object]';
        }

        return Object.fromEntries(
            Object.entries(value)
                .slice(0, 25)
                .map(([key, entry]) => [key, serializeLogValue(entry, depth + 1)])
        );
    }

    if (typeof value === 'string') {
        return truncateString(value, 4000);
    }

    return value;
}

function buildConsolePayload(args = []) {
    return {
        message: truncateString(args.map((arg) => {
            if (typeof arg === 'string') {
                return arg;
            }

            if (arg instanceof Error) {
                return arg.message || String(arg);
            }

            try {
                return JSON.stringify(serializeLogValue(arg));
            } catch (_error) {
                return String(arg);
            }
        }).join(' '), 4000),
        context: args.map((arg) => serializeLogValue(arg))
    };
}

function buildEntryHash(entry, cryptoLib = crypto) {
    return cryptoLib.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
}

function sanitizeSyslogToken(value, fallback = '-') {
    if (!isNonEmptyString(value)) {
        return fallback;
    }

    const normalized = String(value).trim().replace(/\s+/g, '-');
    return normalized.replace(/[\]["=]/g, '-') || fallback;
}

function escapeSyslogStructuredValue(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\]/g, '\\]');
}

function buildSyslogPayload(entry, entryHash) {
    const severity = Object.prototype.hasOwnProperty.call(SYSLOG_LEVEL_MAP, entry.level)
        ? SYSLOG_LEVEL_MAP[entry.level]
        : SYSLOG_LEVEL_MAP.info;
    const priority = (SYSLOG_FACILITY * 8) + severity;
    const appName = sanitizeSyslogToken(entry.source || DEFAULT_SOURCE, DEFAULT_SOURCE);
    const host = sanitizeSyslogToken(entry.host, '-');
    const structuredData = [
        `source="${escapeSyslogStructuredValue(entry.source || DEFAULT_SOURCE)}"`,
        `level="${escapeSyslogStructuredValue(entry.level)}"`,
        `sequence="${escapeSyslogStructuredValue(entry.sequence)}"`,
        `entryHash="${escapeSyslogStructuredValue(entryHash)}"`
    ].join(' ');

    return `<${priority}>1 ${entry.timestamp} ${host} ${appName} - - [note-app@48577 ${structuredData}] ${JSON.stringify({
        message: entry.message,
        metadata: entry.metadata
    })}`;
}

function buildRequestPayload(entry, entryHash, format = DEFAULT_FORMAT) {
    if (format === 'syslog') {
        return {
            body: buildSyslogPayload(entry, entryHash),
            contentType: 'text/plain; charset=utf-8'
        };
    }

    return {
        body: JSON.stringify({
            ...entry,
            entryHash,
            format: 'json'
        }),
        contentType: 'application/json'
    };
}

function createImmutableLogClient(runtimeConfig = {}, options = {}) {
    const immutableLogging = runtimeConfig && runtimeConfig.immutableLogging ? runtimeConfig.immutableLogging : {};
    const fetchImpl = options.fetchImpl || global.fetch;
    const cryptoLib = options.cryptoLib || crypto;
    const osLib = options.osLib || os;
    const clock = options.clock || (() => new Date());
    const fallbackConsole = options.fallbackConsole || console;

    let previousHash = '';
    let sequence = 0;
    let internalLogGuard = false;

    if (!immutableLogging.enabled || typeof fetchImpl !== 'function') {
        return {
            enabled: false,
            capture: async () => false,
            info: async () => false,
            warn: async () => false,
            error: async () => false,
            audit: async () => false
        };
    }

    async function capture(level, message, metadata = {}) {
        const timestamp = clock();
        const format = immutableLogging.format === 'syslog' ? 'syslog' : DEFAULT_FORMAT;
        const enrichedMetadata = enrichMetadataWithRequestContext(metadata);
        const entry = {
            schemaVersion: 1,
            application: 'note-app',
            source: immutableLogging.source || DEFAULT_SOURCE,
            host: typeof osLib.hostname === 'function' ? osLib.hostname() : '',
            level,
            message: truncateString(message || 'Application log event'),
            metadata: serializeLogValue(enrichedMetadata),
            timestamp: timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString(),
            sequence: sequence + 1,
            previousHash
        };

        const entryHash = buildEntryHash(entry, cryptoLib);
        const signature = cryptoLib
            .createHmac('sha256', immutableLogging.token)
            .update(entryHash)
            .digest('hex');
        const requestPayload = buildRequestPayload(entry, entryHash, format);

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutHandle = controller
            ? setTimeout(() => controller.abort(), immutableLogging.timeoutMs || DEFAULT_TIMEOUT_MS)
            : null;

        try {
            const response = await fetchImpl(immutableLogging.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': requestPayload.contentType,
                    Authorization: `Bearer ${immutableLogging.token}`,
                    'X-Log-Chain': entryHash,
                    'X-Log-Signature': signature,
                    'X-Log-Format': format
                },
                body: requestPayload.body,
                signal: controller ? controller.signal : undefined
            });

            if (!response.ok) {
                throw new Error(`Immutable log sink responded with status ${response.status}`);
            }

            previousHash = entryHash;
            sequence += 1;
            return true;
        } catch (error) {
            if (!internalLogGuard) {
                internalLogGuard = true;
                fallbackConsole.warn('[immutable-logging] failed to forward log entry', error && error.message ? error.message : error);
                internalLogGuard = false;
            }
            return false;
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    return {
        enabled: true,
        capture,
        info: (message, metadata) => capture('info', message, metadata),
        warn: (message, metadata) => capture('warn', message, metadata),
        error: (message, metadata) => capture('error', message, metadata),
        audit: (message, metadata) => capture('audit', message, metadata)
    };
}

function installGlobalConsoleMirror(client, options = {}) {
    if (!client || !client.enabled) {
        return () => {};
    }

    const consoleRef = options.consoleRef || console;
    const originalMethods = {};
    let mirrorGuard = false;

    Object.keys(CONSOLE_LEVEL_MAP).forEach((methodName) => {
        if (typeof consoleRef[methodName] !== 'function') {
            return;
        }

        originalMethods[methodName] = consoleRef[methodName].bind(consoleRef);
        consoleRef[methodName] = (...args) => {
            originalMethods[methodName](...args);

            if (mirrorGuard) {
                return;
            }

            mirrorGuard = true;
            const payload = buildConsolePayload(args);
            Promise.resolve(client.capture(CONSOLE_LEVEL_MAP[methodName], payload.message, {
                channel: 'console',
                method: methodName,
                context: payload.context
            })).finally(() => {
                mirrorGuard = false;
            });
        };
    });

    return () => {
        Object.entries(originalMethods).forEach(([methodName, originalMethod]) => {
            consoleRef[methodName] = originalMethod;
        });
    };
}

module.exports = {
    DEFAULT_FORMAT,
    DEFAULT_SOURCE,
    DEFAULT_TIMEOUT_MS,
    buildEntryHash,
    buildRequestPayload,
    createImmutableLogClient,
    installGlobalConsoleMirror
};
