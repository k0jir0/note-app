#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 5000;

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        if (argument === '--allow-disabled') {
            return {
                ...options,
                allowDisabled: true
            };
        }

        const healthUrl = readArgValue(argument, 'health-url');
        if (healthUrl) {
            return {
                ...options,
                healthUrl
            };
        }

        const baseUrl = readArgValue(argument, 'base-url');
        if (baseUrl) {
            return {
                ...options,
                baseUrl
            };
        }

        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const bearerToken = readArgValue(argument, 'bearer-token');
        if (bearerToken) {
            return {
                ...options,
                bearerToken
            };
        }

        const timeoutRaw = readArgValue(argument, 'timeout-ms');
        if (timeoutRaw) {
            const timeoutMs = Number.parseInt(timeoutRaw, 10);

            if (!Number.isInteger(timeoutMs) || timeoutMs < 250) {
                throw new Error('timeout-ms must be an integer greater than or equal to 250.');
            }

            return {
                ...options,
                timeoutMs
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        healthUrl: '',
        baseUrl: '',
        outputFile: '',
        bearerToken: '',
        timeoutMs: DEFAULT_TIMEOUT_MS,
        allowDisabled: false
    });
}

function normalizeBaseUrl(value = '') {
    return String(value || '').trim().replace(/\/+$/, '');
}

function resolveHealthUrl({
    healthUrl = '',
    baseUrl = '',
    env = process.env
} = {}) {
    const explicitHealthUrl = String(healthUrl || env.ITSG33_HEALTHCHECK_URL || '').trim();
    if (explicitHealthUrl) {
        return explicitHealthUrl;
    }

    const resolvedBaseUrl = normalizeBaseUrl(
        baseUrl
        || env.ITSG33_BASE_URL
        || env.APP_BASE_URL
        || DEFAULT_BASE_URL
    );

    return `${resolvedBaseUrl}/healthz`;
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildAuditHealthReport({
    healthUrl,
    statusCode,
    body,
    checkedAt = new Date()
} = {}) {
    const payload = body && typeof body === 'object' ? body : {};
    const immutableLogging = payload.immutableLogging && typeof payload.immutableLogging === 'object'
        ? payload.immutableLogging
        : {};
    const breakGlass = payload.breakGlass && typeof payload.breakGlass === 'object'
        ? payload.breakGlass
        : {};
    const detailsRestricted = Boolean(payload.detailsRestricted);

    return {
        checkedAt: toIsoString(checkedAt),
        healthUrl: String(healthUrl || ''),
        statusCode: Number.isInteger(statusCode) ? statusCode : 0,
        ok: Boolean(payload.ok),
        detailsRestricted,
        breakGlass: {
            mode: String(breakGlass.mode || 'unknown'),
            enabled: Boolean(breakGlass.enabled)
        },
        immutableLogging: {
            enabled: Boolean(immutableLogging.enabled),
            healthy: Boolean(immutableLogging.healthy),
            degraded: Boolean(immutableLogging.degraded),
            requireRemoteSuccess: Boolean(immutableLogging.requireRemoteSuccess)
        },
        checks: {
            httpOk: Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 300,
            appOk: Boolean(payload.ok),
            auditEnabled: Boolean(immutableLogging.enabled),
            auditHealthy: Boolean(immutableLogging.healthy),
            auditNotDegraded: !Boolean(immutableLogging.degraded)
        }
    };
}

function assertAuditHealth(report, { allowDisabled = false } = {}) {
    const failures = [];

    if (!report || typeof report !== 'object') {
        return ['Audit health report is missing or invalid.'];
    }

    if (!report.checks || !report.checks.httpOk) {
        failures.push(`Health endpoint returned HTTP ${report && report.statusCode ? report.statusCode : 'unknown'}.`);
    }

    if (!report.checks || !report.checks.appOk) {
        failures.push('Application health reported ok=false.');
    }

    if (report.detailsRestricted) {
        failures.push('Health endpoint returned restricted diagnostics. Re-run with --bearer-token, ITSG33_HEALTHCHECK_TOKEN, or METRICS_AUTH_TOKEN.');
        return failures;
    }

    if (!allowDisabled && (!report.immutableLogging || !report.immutableLogging.enabled)) {
        failures.push('Immutable logging is not enabled.');
    }

    if (report.immutableLogging && report.immutableLogging.enabled && !report.immutableLogging.healthy) {
        failures.push('Immutable logging is not healthy.');
    }

    if (report.immutableLogging && report.immutableLogging.degraded) {
        failures.push('Immutable logging is degraded.');
    }

    return failures;
}

async function fetchAuditHealth({
    healthUrl,
    bearerToken = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    checkedAt = new Date()
} = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('fetch is unavailable in the current runtime.');
    }

    const headers = {};
    if (String(bearerToken || '').trim()) {
        headers.Authorization = `Bearer ${String(bearerToken).trim()}`;
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutHandle = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const response = await fetchImpl(healthUrl, {
            method: 'GET',
            headers,
            signal: controller ? controller.signal : undefined
        });
        const responseText = await response.text();

        let body;
        try {
            body = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            throw new Error(`Health endpoint returned invalid JSON: ${error.message}`);
        }

        return buildAuditHealthReport({
            healthUrl,
            statusCode: response.status,
            body,
            checkedAt
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(`Health check timed out after ${timeoutMs}ms.`);
        }

        throw error;
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

function writeAuditHealthReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });

    const options = parseArgs(process.argv.slice(2));
    const healthUrl = resolveHealthUrl({
        healthUrl: options.healthUrl,
        baseUrl: options.baseUrl
    });
    const bearerToken = options.bearerToken || process.env.ITSG33_HEALTHCHECK_TOKEN || process.env.METRICS_AUTH_TOKEN || '';

    const report = await fetchAuditHealth({
        healthUrl,
        bearerToken,
        timeoutMs: options.timeoutMs
    });
    const failures = assertAuditHealth(report, {
        allowDisabled: options.allowDisabled
    });

    if (options.outputFile) {
        const outputPath = writeAuditHealthReport(options.outputFile, report);
        console.log(`Wrote ITSG-33 audit health report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (failures.length) {
        failures.forEach((failure) => {
            console.error(`[itsg33] ${failure}`);
        });
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Audit health check failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    assertAuditHealth,
    buildAuditHealthReport,
    fetchAuditHealth,
    parseArgs,
    resolveHealthUrl,
    writeAuditHealthReport
};
