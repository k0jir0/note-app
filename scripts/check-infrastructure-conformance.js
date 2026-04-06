#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const tls = require('tls');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { fetchAuditHealth } = require('./check-audit-health');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MIN_CERT_VALID_DAYS = 14;

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parsePositiveInteger(rawValue, fieldName, fallback) {
    if (!String(rawValue || '').trim()) {
        return fallback;
    }

    const parsedValue = Number.parseInt(String(rawValue).trim(), 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }

    return parsedValue;
}

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        const publicBaseUrl = readArgValue(argument, 'public-base-url');
        if (publicBaseUrl) {
            return {
                ...options,
                publicBaseUrl
            };
        }

        const pageUrl = readArgValue(argument, 'page-url');
        if (pageUrl) {
            return {
                ...options,
                pageUrl
            };
        }

        const healthUrl = readArgValue(argument, 'health-url');
        if (healthUrl) {
            return {
                ...options,
                healthUrl
            };
        }

        const bearerToken = readArgValue(argument, 'bearer-token');
        if (bearerToken) {
            return {
                ...options,
                bearerToken
            };
        }

        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const timeoutRaw = readArgValue(argument, 'timeout-ms');
        if (timeoutRaw) {
            return {
                ...options,
                timeoutMs: parsePositiveInteger(timeoutRaw, 'timeout-ms', DEFAULT_TIMEOUT_MS)
            };
        }

        const minCertValidDaysRaw = readArgValue(argument, 'min-cert-valid-days');
        if (minCertValidDaysRaw) {
            return {
                ...options,
                minCertValidDays: parsePositiveInteger(minCertValidDaysRaw, 'min-cert-valid-days', DEFAULT_MIN_CERT_VALID_DAYS)
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        publicBaseUrl: '',
        pageUrl: '',
        healthUrl: '',
        bearerToken: '',
        outputFile: '',
        timeoutMs: DEFAULT_TIMEOUT_MS,
        minCertValidDays: DEFAULT_MIN_CERT_VALID_DAYS
    });
}

function normalizeUrl(value = '') {
    return String(value || '').trim().replace(/\/+$/, '');
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deriveHttpProbeUrl(publicBaseUrl = '') {
    const normalizedUrl = normalizeUrl(publicBaseUrl);
    if (!normalizedUrl) {
        return '';
    }

    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol !== 'https:') {
        return '';
    }

    parsedUrl.protocol = 'http:';
    return parsedUrl.toString().replace(/\/$/, '');
}

function getHeaderValue(headers, name) {
    if (!headers) {
        return '';
    }

    if (typeof headers.get === 'function') {
        return String(headers.get(name) || '').trim();
    }

    const directValue = headers[name] || headers[String(name || '').toLowerCase()];
    if (Array.isArray(directValue)) {
        return String(directValue[0] || '').trim();
    }

    return String(directValue || '').trim();
}

function resolveInfrastructureConformanceOptions(options = {}, env = process.env) {
    const publicBaseUrl = normalizeUrl(options.publicBaseUrl || env.ITSG33_PUBLIC_BASE_URL || env.APP_BASE_URL || '');
    return {
        publicBaseUrl,
        pageUrl: normalizeUrl(options.pageUrl || env.ITSG33_PAGE_URL || publicBaseUrl || ''),
        healthUrl: normalizeUrl(options.healthUrl || env.ITSG33_HEALTHCHECK_URL || (publicBaseUrl ? `${publicBaseUrl}/healthz` : '')),
        bearerToken: String(options.bearerToken || env.ITSG33_HEALTHCHECK_TOKEN || env.METRICS_AUTH_TOKEN || '').trim(),
        outputFile: String(options.outputFile || '').trim(),
        timeoutMs: parsePositiveInteger(options.timeoutMs || env.ITSG33_INFRASTRUCTURE_TIMEOUT_MS, 'timeout-ms', DEFAULT_TIMEOUT_MS),
        minCertValidDays: parsePositiveInteger(options.minCertValidDays || env.ITSG33_MIN_CERT_VALID_DAYS, 'min-cert-valid-days', DEFAULT_MIN_CERT_VALID_DAYS)
    };
}

async function probeHttpRedirect(url, {
    expectedLocation = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
} = {}) {
    if (!String(url || '').trim()) {
        return {
            executed: false,
            skipped: true,
            success: null,
            statusCode: 0,
            location: '',
            reason: 'No HTTP probe URL configured.'
        };
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('fetch is unavailable in the current runtime.');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutHandle = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller ? controller.signal : undefined
        });
        const location = getHeaderValue(response.headers, 'location');
        const success = response.status >= 300
            && response.status < 400
            && (!expectedLocation || location === expectedLocation);

        return {
            executed: true,
            skipped: false,
            success,
            statusCode: response.status,
            location,
            reason: success
                ? `HTTP redirected to ${location || 'the expected HTTPS origin'}.`
                : `Expected HTTP redirect to ${expectedLocation || 'an HTTPS location'} but received ${response.status} ${location || ''}`.trim()
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                executed: true,
                skipped: false,
                success: false,
                statusCode: 0,
                location: '',
                reason: `HTTP redirect probe timed out after ${timeoutMs}ms.`
            };
        }

        return {
            executed: true,
            skipped: false,
            success: false,
            statusCode: 0,
            location: '',
            reason: `HTTP redirect probe failed: ${error.message}`
        };
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

async function probePageHeaders(url, {
    bearerToken = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
} = {}) {
    if (!String(url || '').trim()) {
        return {
            executed: false,
            skipped: true,
            success: null,
            statusCode: 0,
            headers: {
                strictTransportSecurity: '',
                contentSecurityPolicy: ''
            },
            checks: {
                hstsPresent: false,
                cspPresent: false
            },
            reason: 'No page URL configured.'
        };
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('fetch is unavailable in the current runtime.');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutHandle = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const headers = {};
        if (String(bearerToken || '').trim()) {
            headers.Authorization = `Bearer ${String(bearerToken).trim()}`;
        }

        const response = await fetchImpl(url, {
            method: 'GET',
            headers,
            signal: controller ? controller.signal : undefined
        });

        const strictTransportSecurity = getHeaderValue(response.headers, 'strict-transport-security');
        const contentSecurityPolicy = getHeaderValue(response.headers, 'content-security-policy');
        const success = response.status >= 200 && response.status < 400;

        return {
            executed: true,
            skipped: false,
            success,
            statusCode: response.status,
            headers: {
                strictTransportSecurity,
                contentSecurityPolicy
            },
            checks: {
                hstsPresent: Boolean(strictTransportSecurity),
                cspPresent: Boolean(contentSecurityPolicy)
            },
            reason: success
                ? 'Page header probe completed.'
                : `Expected the page probe to succeed but received HTTP ${response.status}.`
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                executed: true,
                skipped: false,
                success: false,
                statusCode: 0,
                headers: {
                    strictTransportSecurity: '',
                    contentSecurityPolicy: ''
                },
                checks: {
                    hstsPresent: false,
                    cspPresent: false
                },
                reason: `Page header probe timed out after ${timeoutMs}ms.`
            };
        }

        return {
            executed: true,
            skipped: false,
            success: false,
            statusCode: 0,
            headers: {
                strictTransportSecurity: '',
                contentSecurityPolicy: ''
            },
            checks: {
                hstsPresent: false,
                cspPresent: false
            },
            reason: `Page header probe failed: ${error.message}`
        };
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

async function probeTlsCertificate(url, {
    minimumValidDays = DEFAULT_MIN_CERT_VALID_DAYS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    connectTlsImpl = (options, callback) => tls.connect(options, callback)
} = {}) {
    if (!String(url || '').trim()) {
        return {
            executed: false,
            skipped: true,
            success: null,
            protocol: '',
            validFrom: null,
            validTo: null,
            daysUntilExpiry: null,
            reason: 'No public HTTPS URL configured.'
        };
    }

    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
        return {
            executed: false,
            skipped: true,
            success: null,
            protocol: '',
            validFrom: null,
            validTo: null,
            daysUntilExpiry: null,
            reason: 'TLS probe is only applicable to HTTPS URLs.'
        };
    }

    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const socket = connectTlsImpl({
            host: parsedUrl.hostname,
            port: Number(parsedUrl.port) || 443,
            servername: parsedUrl.hostname,
            rejectUnauthorized: false
        }, () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);
            const certificate = typeof socket.getPeerCertificate === 'function'
                ? socket.getPeerCertificate()
                : {};
            const protocol = typeof socket.getProtocol === 'function' ? String(socket.getProtocol() || '') : '';
            const validFrom = toIsoString(certificate.valid_from);
            const validTo = toIsoString(certificate.valid_to);
            const expiryDate = validTo ? new Date(validTo) : null;
            const daysUntilExpiry = expiryDate
                ? Math.floor((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                : null;
            const success = Boolean(protocol)
                && Number.isInteger(daysUntilExpiry)
                && daysUntilExpiry >= minimumValidDays;

            if (typeof socket.end === 'function') {
                socket.end();
            }

            resolve({
                executed: true,
                skipped: false,
                success,
                protocol,
                validFrom,
                validTo,
                daysUntilExpiry,
                reason: success
                    ? `TLS certificate is valid for ${daysUntilExpiry} more day(s).`
                    : `TLS certificate validity is below the ${minimumValidDays}d threshold or the protocol was unavailable.`
            });
        });

        timer = setTimeout(() => {
            if (settled) {
                return;
            }

            settled = true;
            if (typeof socket.destroy === 'function') {
                socket.destroy();
            }
            resolve({
                executed: true,
                skipped: false,
                success: false,
                protocol: '',
                validFrom: null,
                validTo: null,
                daysUntilExpiry: null,
                reason: `TLS probe timed out after ${timeoutMs}ms.`
            });
        }, timeoutMs);

        socket.once('error', (error) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);
            resolve({
                executed: true,
                skipped: false,
                success: false,
                protocol: '',
                validFrom: null,
                validTo: null,
                daysUntilExpiry: null,
                reason: `TLS probe failed: ${error.message}`
            });
        });

        socket.once('close', () => {
            clearTimeout(timer);
        });
    });
}

function buildInfrastructureConformanceReport({
    publicBaseUrl,
    pageUrl,
    healthUrl,
    checkedAt = new Date(),
    httpRedirect,
    pageHeaders,
    tlsCertificate,
    auditHealth
} = {}) {
    return {
        checkedAt: toIsoString(checkedAt),
        publicBaseUrl: String(publicBaseUrl || ''),
        pageUrl: String(pageUrl || ''),
        healthUrl: String(healthUrl || ''),
        httpRedirect: httpRedirect || null,
        pageHeaders: pageHeaders || null,
        tlsCertificate: tlsCertificate || null,
        auditHealth: auditHealth || null
    };
}

function assertInfrastructureConformance(report, {
    minimumCertValidDays = DEFAULT_MIN_CERT_VALID_DAYS
} = {}) {
    const failures = [];

    if (!report || typeof report !== 'object') {
        return ['Infrastructure conformance report is missing or invalid.'];
    }

    const publicBaseUrl = String(report.publicBaseUrl || '').trim();
    if (!publicBaseUrl || !publicBaseUrl.startsWith('https://')) {
        failures.push('Public base URL is not configured with https://.');
    }

    if (report.httpRedirect && report.httpRedirect.executed && report.httpRedirect.success === false) {
        failures.push(report.httpRedirect.reason || 'HTTP redirect probe failed.');
    }

    if (report.tlsCertificate && report.tlsCertificate.executed && report.tlsCertificate.success === false) {
        failures.push(report.tlsCertificate.reason || 'TLS certificate probe failed.');
    }

    if (report.tlsCertificate && Number.isInteger(report.tlsCertificate.daysUntilExpiry)
        && report.tlsCertificate.daysUntilExpiry < minimumCertValidDays) {
        failures.push(`TLS certificate expires in fewer than ${minimumCertValidDays} day(s).`);
    }

    if (report.pageHeaders && report.pageHeaders.executed) {
        if (!report.pageHeaders.checks || !report.pageHeaders.checks.hstsPresent) {
            failures.push('Strict-Transport-Security header is missing.');
        }
        if (!report.pageHeaders.checks || !report.pageHeaders.checks.cspPresent) {
            failures.push('Content-Security-Policy header is missing.');
        }
    }

    if (report.auditHealth) {
        if (!report.auditHealth.checks || !report.auditHealth.checks.httpOk) {
            failures.push(`Health endpoint returned HTTP ${report.auditHealth.statusCode || 'unknown'}.`);
        }
        if (!report.auditHealth.checks || !report.auditHealth.checks.appOk) {
            failures.push('Application health reported ok=false.');
        }
        if (report.auditHealth.detailsRestricted) {
            failures.push('Health endpoint returned restricted diagnostics.');
        }
    }

    return failures;
}

async function runInfrastructureConformanceCheck(options = {}, {
    fetchImpl = globalThis.fetch,
    connectTlsImpl,
    fetchAuditHealthImpl = fetchAuditHealth
} = {}) {
    const resolvedOptions = resolveInfrastructureConformanceOptions(options);
    const httpProbeUrl = deriveHttpProbeUrl(resolvedOptions.publicBaseUrl);
    const checkedAt = new Date();

    const httpRedirect = await probeHttpRedirect(httpProbeUrl, {
        expectedLocation: resolvedOptions.publicBaseUrl,
        timeoutMs: resolvedOptions.timeoutMs,
        fetchImpl
    });

    const pageHeaders = await probePageHeaders(resolvedOptions.pageUrl, {
        timeoutMs: resolvedOptions.timeoutMs,
        fetchImpl
    });

    const tlsCertificate = await probeTlsCertificate(resolvedOptions.publicBaseUrl, {
        minimumValidDays: resolvedOptions.minCertValidDays,
        timeoutMs: resolvedOptions.timeoutMs,
        connectTlsImpl
    });

    const auditHealth = resolvedOptions.healthUrl
        ? await fetchAuditHealthImpl({
            healthUrl: resolvedOptions.healthUrl,
            bearerToken: resolvedOptions.bearerToken,
            timeoutMs: resolvedOptions.timeoutMs,
            fetchImpl
        })
        : null;

    return buildInfrastructureConformanceReport({
        publicBaseUrl: resolvedOptions.publicBaseUrl,
        pageUrl: resolvedOptions.pageUrl,
        healthUrl: resolvedOptions.healthUrl,
        checkedAt,
        httpRedirect,
        pageHeaders,
        tlsCertificate,
        auditHealth
    });
}

function writeInfrastructureConformanceReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });
    const options = parseArgs(process.argv.slice(2));
    const report = await runInfrastructureConformanceCheck(options);
    const failures = assertInfrastructureConformance(report, {
        minimumCertValidDays: resolveInfrastructureConformanceOptions(options).minCertValidDays
    });

    if (options.outputFile) {
        const outputPath = writeInfrastructureConformanceReport(options.outputFile, report);
        console.log(`Wrote infrastructure conformance report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (failures.length > 0) {
        failures.forEach((failure) => {
            console.error(`[itsg33] ${failure}`);
        });
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Infrastructure conformance check failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_MIN_CERT_VALID_DAYS,
    DEFAULT_TIMEOUT_MS,
    assertInfrastructureConformance,
    buildInfrastructureConformanceReport,
    deriveHttpProbeUrl,
    parseArgs,
    probeHttpRedirect,
    probePageHeaders,
    probeTlsCertificate,
    resolveInfrastructureConformanceOptions,
    runInfrastructureConformanceCheck,
    writeInfrastructureConformanceReport
};
