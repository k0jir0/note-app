#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_HTTP_TIMEOUT_MS = 5000;

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parseIntegerArg(rawValue, fieldName, fallback) {
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
        const backupSource = readArgValue(argument, 'backup-source');
        if (backupSource) {
            return {
                ...options,
                backupSource
            };
        }

        const restoreTarget = readArgValue(argument, 'restore-target');
        if (restoreTarget) {
            return {
                ...options,
                restoreTarget
            };
        }

        const drillEnvironment = readArgValue(argument, 'drill-environment');
        if (drillEnvironment) {
            return {
                ...options,
                drillEnvironment
            };
        }

        const prepareCommand = readArgValue(argument, 'prepare-command');
        if (prepareCommand) {
            return {
                ...options,
                prepareCommand
            };
        }

        const restoreCommand = readArgValue(argument, 'restore-command');
        if (restoreCommand) {
            return {
                ...options,
                restoreCommand
            };
        }

        const postRestoreCommand = readArgValue(argument, 'post-restore-command');
        if (postRestoreCommand) {
            return {
                ...options,
                postRestoreCommand
            };
        }

        const validationCommand = readArgValue(argument, 'validation-command');
        if (validationCommand) {
            return {
                ...options,
                validationCommand
            };
        }

        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const healthUrl = readArgValue(argument, 'health-url');
        if (healthUrl) {
            return {
                ...options,
                healthUrl
            };
        }

        const authUrl = readArgValue(argument, 'auth-url');
        if (authUrl) {
            return {
                ...options,
                authUrl
            };
        }

        const healthBearerToken = readArgValue(argument, 'health-bearer-token');
        if (healthBearerToken) {
            return {
                ...options,
                healthBearerToken
            };
        }

        const authBearerToken = readArgValue(argument, 'auth-bearer-token');
        if (authBearerToken) {
            return {
                ...options,
                authBearerToken
            };
        }

        const timeoutRaw = readArgValue(argument, 'timeout-ms');
        if (timeoutRaw) {
            return {
                ...options,
                timeoutMs: parseIntegerArg(timeoutRaw, 'timeout-ms', DEFAULT_TIMEOUT_MS)
            };
        }

        const httpTimeoutRaw = readArgValue(argument, 'http-timeout-ms');
        if (httpTimeoutRaw) {
            return {
                ...options,
                httpTimeoutMs: parseIntegerArg(httpTimeoutRaw, 'http-timeout-ms', DEFAULT_HTTP_TIMEOUT_MS)
            };
        }

        const authExpectedStatusRaw = readArgValue(argument, 'auth-expected-status');
        if (authExpectedStatusRaw) {
            return {
                ...options,
                authExpectedStatus: parseIntegerArg(authExpectedStatusRaw, 'auth-expected-status', 200)
            };
        }

        const healthExpectedStatusRaw = readArgValue(argument, 'health-expected-status');
        if (healthExpectedStatusRaw) {
            return {
                ...options,
                healthExpectedStatus: parseIntegerArg(healthExpectedStatusRaw, 'health-expected-status', 200)
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        backupSource: '',
        restoreTarget: '',
        drillEnvironment: '',
        prepareCommand: '',
        restoreCommand: '',
        postRestoreCommand: '',
        validationCommand: '',
        outputFile: '',
        healthUrl: '',
        authUrl: '',
        healthBearerToken: '',
        authBearerToken: '',
        timeoutMs: DEFAULT_TIMEOUT_MS,
        httpTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
        authExpectedStatus: 200,
        healthExpectedStatus: 200
    });
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitizeUrlForReport(rawUrl = '') {
    const urlText = String(rawUrl || '').trim();
    if (!urlText) {
        return '';
    }

    try {
        const parsedUrl = new URL(urlText);
        return `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
        return urlText.split('?')[0];
    }
}

function createSkippedStep(reason) {
    return {
        executed: false,
        skipped: true,
        success: null,
        reason: String(reason || 'Skipped.')
    };
}

function resolveBackupRestoreOptions(options = {}, env = process.env) {
    return {
        backupSource: String(options.backupSource || env.ITSG33_BACKUP_SOURCE_LABEL || 'unspecified-backup-source').trim(),
        restoreTarget: String(options.restoreTarget || env.ITSG33_RESTORE_TARGET_LABEL || 'unspecified-restore-target').trim(),
        drillEnvironment: String(options.drillEnvironment || env.ITSG33_RESTORE_DRILL_ENVIRONMENT || 'staging').trim(),
        prepareCommand: String(options.prepareCommand || env.ITSG33_PREPARE_RESTORE_COMMAND || '').trim(),
        restoreCommand: String(options.restoreCommand || env.ITSG33_RESTORE_COMMAND || '').trim(),
        postRestoreCommand: String(options.postRestoreCommand || env.ITSG33_POST_RESTORE_COMMAND || '').trim(),
        validationCommand: String(options.validationCommand || env.ITSG33_RESTORE_VALIDATION_COMMAND || '').trim(),
        outputFile: String(options.outputFile || '').trim(),
        healthUrl: String(options.healthUrl || env.ITSG33_RESTORE_HEALTH_URL || '').trim(),
        authUrl: String(options.authUrl || env.ITSG33_RESTORE_AUTH_URL || '').trim(),
        healthBearerToken: String(options.healthBearerToken || env.ITSG33_RESTORE_HEALTHCHECK_TOKEN || '').trim(),
        authBearerToken: String(options.authBearerToken || env.ITSG33_RESTORE_AUTH_TOKEN || '').trim(),
        timeoutMs: parseIntegerArg(options.timeoutMs || env.ITSG33_RESTORE_TIMEOUT_MS, 'timeout-ms', DEFAULT_TIMEOUT_MS),
        httpTimeoutMs: parseIntegerArg(options.httpTimeoutMs || env.ITSG33_RESTORE_HTTP_TIMEOUT_MS, 'http-timeout-ms', DEFAULT_HTTP_TIMEOUT_MS),
        authExpectedStatus: parseIntegerArg(options.authExpectedStatus || env.ITSG33_RESTORE_AUTH_EXPECTED_STATUS, 'auth-expected-status', 200),
        healthExpectedStatus: parseIntegerArg(options.healthExpectedStatus || env.ITSG33_RESTORE_HEALTH_EXPECTED_STATUS, 'health-expected-status', 200)
    };
}

function validateBackupRestoreOptions(options = {}) {
    if (!String(options.restoreCommand || '').trim()) {
        throw new Error('restoreCommand is required for the backup and restore drill.');
    }

    return options;
}

async function executeShellCommand(command, {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    spawnImpl = spawn,
    cwd = process.cwd(),
    env = process.env
} = {}) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        let settled = false;
        const child = spawnImpl(command, [], {
            cwd,
            env,
            shell: true,
            windowsHide: true
        });
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            if (typeof child.kill === 'function') {
                child.kill();
            }
        }, timeoutMs);

        child.once('error', (error) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);
            reject(error);
        });

        child.once('close', (exitCode, signal) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);
            const durationMs = Date.now() - startedAt;
            resolve({
                exitCode: Number.isInteger(exitCode) ? exitCode : 1,
                signal: signal || '',
                timedOut,
                durationMs,
                success: !timedOut && exitCode === 0,
                reason: timedOut
                    ? `Command timed out after ${timeoutMs}ms.`
                    : (exitCode === 0 ? 'Command completed successfully.' : `Command exited with code ${exitCode}.`)
            });
        });
    });
}

async function probeHttpEndpoint(url, {
    expectedStatus = 200,
    timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
    bearerToken = '',
    fetchImpl = globalThis.fetch
} = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('fetch is unavailable in the current runtime.');
    }

    const startedAt = Date.now();
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

        return {
            executed: true,
            skipped: false,
            success: response.status === expectedStatus,
            url: sanitizeUrlForReport(url),
            expectedStatus,
            statusCode: response.status,
            durationMs: Date.now() - startedAt,
            reason: response.status === expectedStatus
                ? `Endpoint responded with expected HTTP ${expectedStatus}.`
                : `Expected HTTP ${expectedStatus} but received HTTP ${response.status}.`
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                executed: true,
                skipped: false,
                success: false,
                url: sanitizeUrlForReport(url),
                expectedStatus,
                statusCode: 0,
                durationMs: Date.now() - startedAt,
                reason: `Endpoint probe timed out after ${timeoutMs}ms.`
            };
        }

        return {
            executed: true,
            skipped: false,
            success: false,
            url: sanitizeUrlForReport(url),
            expectedStatus,
            statusCode: 0,
            durationMs: Date.now() - startedAt,
            reason: `Endpoint probe failed: ${error.message}`
        };
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

function summarizeDrillSteps(steps = {}) {
    const stepEntries = Object.entries(steps);
    const failedSteps = stepEntries
        .filter(([, step]) => step && step.executed && step.success === false)
        .map(([stepName, step]) => ({
            step: stepName,
            reason: step.reason || 'Step failed.'
        }));

    return {
        executedSteps: stepEntries.filter(([, step]) => step && step.executed).length,
        skippedSteps: stepEntries.filter(([, step]) => step && step.skipped).length,
        failedSteps,
        restoreDurationMs: steps.restore && steps.restore.executed ? steps.restore.durationMs : 0
    };
}

function buildBackupRestoreReport({
    backupSource,
    restoreTarget,
    drillEnvironment,
    startedAt,
    completedAt,
    steps
} = {}) {
    const summary = summarizeDrillSteps(steps);

    return {
        generatedAt: toIsoString(completedAt),
        backupSource: String(backupSource || ''),
        restoreTarget: String(restoreTarget || ''),
        drillEnvironment: String(drillEnvironment || ''),
        success: summary.failedSteps.length === 0 && Boolean(steps && steps.restore && steps.restore.success),
        summary: {
            overallDurationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
            restoreDurationMs: summary.restoreDurationMs,
            executedSteps: summary.executedSteps,
            skippedSteps: summary.skippedSteps,
            failedSteps: summary.failedSteps.length
        },
        failures: summary.failedSteps,
        steps
    };
}

async function runCommandStep({
    command,
    timeoutMs,
    executeCommandImpl = executeShellCommand,
    env = process.env
} = {}) {
    const result = await executeCommandImpl(command, {
        timeoutMs,
        env
    });

    return {
        executed: true,
        skipped: false,
        success: Boolean(result && result.success),
        durationMs: Number.isInteger(result && result.durationMs) ? result.durationMs : 0,
        exitCode: Number.isInteger(result && result.exitCode) ? result.exitCode : 1,
        timedOut: Boolean(result && result.timedOut),
        reason: result && result.reason ? String(result.reason) : 'Command completed.'
    };
}

async function runBackupRestoreDrill(options = {}, {
    env = process.env,
    executeCommandImpl = executeShellCommand,
    probeHttpEndpointImpl = probeHttpEndpoint
} = {}) {
    const resolvedOptions = validateBackupRestoreOptions(resolveBackupRestoreOptions(options, env));
    const startedAt = new Date();
    const steps = {};

    if (resolvedOptions.prepareCommand) {
        steps.prepare = await runCommandStep({
            command: resolvedOptions.prepareCommand,
            timeoutMs: resolvedOptions.timeoutMs,
            executeCommandImpl,
            env
        });
    } else {
        steps.prepare = createSkippedStep('No prepare command configured.');
    }

    if (steps.prepare.executed && !steps.prepare.success) {
        steps.restore = createSkippedStep('Skipped because the prepare step failed.');
        steps.postRestore = createSkippedStep('Skipped because the prepare step failed.');
        steps.healthCheck = createSkippedStep('Skipped because the prepare step failed.');
        steps.authCheck = createSkippedStep('Skipped because the prepare step failed.');
        steps.validation = createSkippedStep('Skipped because the prepare step failed.');
        return buildBackupRestoreReport({
            backupSource: resolvedOptions.backupSource,
            restoreTarget: resolvedOptions.restoreTarget,
            drillEnvironment: resolvedOptions.drillEnvironment,
            startedAt,
            completedAt: new Date(),
            steps
        });
    }

    steps.restore = await runCommandStep({
        command: resolvedOptions.restoreCommand,
        timeoutMs: resolvedOptions.timeoutMs,
        executeCommandImpl,
        env
    });

    if (steps.restore.executed && !steps.restore.success) {
        steps.postRestore = createSkippedStep('Skipped because the restore step failed.');
        steps.healthCheck = createSkippedStep('Skipped because the restore step failed.');
        steps.authCheck = createSkippedStep('Skipped because the restore step failed.');
        steps.validation = createSkippedStep('Skipped because the restore step failed.');
        return buildBackupRestoreReport({
            backupSource: resolvedOptions.backupSource,
            restoreTarget: resolvedOptions.restoreTarget,
            drillEnvironment: resolvedOptions.drillEnvironment,
            startedAt,
            completedAt: new Date(),
            steps
        });
    }

    if (resolvedOptions.postRestoreCommand) {
        steps.postRestore = await runCommandStep({
            command: resolvedOptions.postRestoreCommand,
            timeoutMs: resolvedOptions.timeoutMs,
            executeCommandImpl,
            env
        });
    } else {
        steps.postRestore = createSkippedStep('No post-restore command configured.');
    }

    const verificationBlocked = steps.postRestore.executed && !steps.postRestore.success;

    if (resolvedOptions.healthUrl) {
        steps.healthCheck = verificationBlocked
            ? createSkippedStep('Skipped because the post-restore step failed.')
            : await probeHttpEndpointImpl(resolvedOptions.healthUrl, {
                bearerToken: resolvedOptions.healthBearerToken,
                expectedStatus: resolvedOptions.healthExpectedStatus,
                timeoutMs: resolvedOptions.httpTimeoutMs
            });
    } else {
        steps.healthCheck = createSkippedStep('No health check URL configured.');
    }

    if (resolvedOptions.authUrl) {
        steps.authCheck = verificationBlocked
            ? createSkippedStep('Skipped because the post-restore step failed.')
            : await probeHttpEndpointImpl(resolvedOptions.authUrl, {
                bearerToken: resolvedOptions.authBearerToken,
                expectedStatus: resolvedOptions.authExpectedStatus,
                timeoutMs: resolvedOptions.httpTimeoutMs
            });
    } else {
        steps.authCheck = createSkippedStep('No auth check URL configured.');
    }

    if (resolvedOptions.validationCommand) {
        steps.validation = verificationBlocked
            ? createSkippedStep('Skipped because the post-restore step failed.')
            : await runCommandStep({
                command: resolvedOptions.validationCommand,
                timeoutMs: resolvedOptions.timeoutMs,
                executeCommandImpl,
                env
            });
    } else {
        steps.validation = createSkippedStep('No representative protected-route validation command configured.');
    }

    return buildBackupRestoreReport({
        backupSource: resolvedOptions.backupSource,
        restoreTarget: resolvedOptions.restoreTarget,
        drillEnvironment: resolvedOptions.drillEnvironment,
        startedAt,
        completedAt: new Date(),
        steps
    });
}

function writeBackupRestoreReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });
    const options = parseArgs(process.argv.slice(2));
    const report = await runBackupRestoreDrill(options);

    if (options.outputFile) {
        const outputPath = writeBackupRestoreReport(options.outputFile, report);
        console.log(`Wrote backup and restore drill report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (!report.success) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Backup and restore drill failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_HTTP_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    buildBackupRestoreReport,
    createSkippedStep,
    executeShellCommand,
    parseArgs,
    probeHttpEndpoint,
    resolveBackupRestoreOptions,
    runBackupRestoreDrill,
    sanitizeUrlForReport,
    validateBackupRestoreOptions,
    writeBackupRestoreReport
};
