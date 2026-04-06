#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { executeShellCommand, createSkippedStep } = require('./run-backup-restore-drill');
const { normalizeBreakGlassMode, BREAK_GLASS_MODES } = require('../src/services/breakGlassService');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_HTTP_TIMEOUT_MS = 5000;

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

        const activateCommand = readArgValue(argument, 'activate-command');
        if (activateCommand) {
            return {
                ...options,
                activateCommand
            };
        }

        const resetCommand = readArgValue(argument, 'reset-command');
        if (resetCommand) {
            return {
                ...options,
                resetCommand
            };
        }

        const validationCommand = readArgValue(argument, 'validation-command');
        if (validationCommand) {
            return {
                ...options,
                validationCommand
            };
        }

        const auditValidationCommand = readArgValue(argument, 'audit-validation-command');
        if (auditValidationCommand) {
            return {
                ...options,
                auditValidationCommand
            };
        }

        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const baseUrl = readArgValue(argument, 'base-url');
        if (baseUrl) {
            return {
                ...options,
                baseUrl
            };
        }

        const healthUrl = readArgValue(argument, 'health-url');
        if (healthUrl) {
            return {
                ...options,
                healthUrl
            };
        }

        const healthBearerToken = readArgValue(argument, 'health-bearer-token');
        if (healthBearerToken) {
            return {
                ...options,
                healthBearerToken
            };
        }

        const targetMode = readArgValue(argument, 'target-mode');
        if (targetMode) {
            return {
                ...options,
                targetMode
            };
        }

        const timeoutRaw = readArgValue(argument, 'timeout-ms');
        if (timeoutRaw) {
            return {
                ...options,
                timeoutMs: parsePositiveInteger(timeoutRaw, 'timeout-ms', DEFAULT_TIMEOUT_MS)
            };
        }

        const httpTimeoutRaw = readArgValue(argument, 'http-timeout-ms');
        if (httpTimeoutRaw) {
            return {
                ...options,
                httpTimeoutMs: parsePositiveInteger(httpTimeoutRaw, 'http-timeout-ms', DEFAULT_HTTP_TIMEOUT_MS)
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        drillEnvironment: '',
        prepareCommand: '',
        activateCommand: '',
        resetCommand: '',
        validationCommand: '',
        auditValidationCommand: '',
        outputFile: '',
        baseUrl: '',
        healthUrl: '',
        healthBearerToken: '',
        targetMode: '',
        timeoutMs: DEFAULT_TIMEOUT_MS,
        httpTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS
    });
}

function normalizeBaseUrl(value = '') {
    return String(value || '').trim().replace(/\/+$/, '');
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveBreakGlassDrillOptions(options = {}, env = process.env) {
    const baseUrl = normalizeBaseUrl(options.baseUrl || env.ITSG33_BREAK_GLASS_BASE_URL || env.APP_BASE_URL || '');

    return {
        drillEnvironment: String(options.drillEnvironment || env.ITSG33_BREAK_GLASS_DRILL_ENVIRONMENT || 'staging').trim(),
        prepareCommand: String(options.prepareCommand || env.ITSG33_BREAK_GLASS_PREPARE_COMMAND || '').trim(),
        activateCommand: String(options.activateCommand || env.ITSG33_BREAK_GLASS_ACTIVATE_COMMAND || '').trim(),
        resetCommand: String(options.resetCommand || env.ITSG33_BREAK_GLASS_RESET_COMMAND || '').trim(),
        validationCommand: String(options.validationCommand || env.ITSG33_BREAK_GLASS_VALIDATION_COMMAND || '').trim(),
        auditValidationCommand: String(options.auditValidationCommand || env.ITSG33_BREAK_GLASS_AUDIT_VALIDATION_COMMAND || '').trim(),
        outputFile: String(options.outputFile || '').trim(),
        baseUrl,
        healthUrl: String(options.healthUrl || env.ITSG33_BREAK_GLASS_HEALTH_URL || (baseUrl ? `${baseUrl}/healthz` : '')).trim(),
        healthBearerToken: String(options.healthBearerToken || env.ITSG33_BREAK_GLASS_HEALTHCHECK_TOKEN || env.ITSG33_HEALTHCHECK_TOKEN || '').trim(),
        targetMode: String(options.targetMode || env.ITSG33_BREAK_GLASS_TARGET_MODE || BREAK_GLASS_MODES.OFFLINE).trim(),
        timeoutMs: parsePositiveInteger(options.timeoutMs || env.ITSG33_BREAK_GLASS_TIMEOUT_MS, 'timeout-ms', DEFAULT_TIMEOUT_MS),
        httpTimeoutMs: parsePositiveInteger(options.httpTimeoutMs || env.ITSG33_BREAK_GLASS_HTTP_TIMEOUT_MS, 'http-timeout-ms', DEFAULT_HTTP_TIMEOUT_MS)
    };
}

function validateBreakGlassDrillOptions(options = {}) {
    const normalizedEnvironment = String(options.drillEnvironment || '').trim().toLowerCase();
    if (normalizedEnvironment === 'production' || normalizedEnvironment === 'prod') {
        throw new Error('Break-glass drills must not target production environments.');
    }

    if (!String(options.activateCommand || '').trim()) {
        throw new Error('activateCommand is required for the break-glass drill.');
    }

    if (!String(options.resetCommand || '').trim()) {
        throw new Error('resetCommand is required for the break-glass drill.');
    }

    const normalizedTargetMode = normalizeBreakGlassMode(options.targetMode);
    if (!normalizedTargetMode || normalizedTargetMode === BREAK_GLASS_MODES.DISABLED) {
        throw new Error('targetMode must be read_only or offline for the break-glass drill.');
    }

    return {
        ...options,
        targetMode: normalizedTargetMode
    };
}

async function probeBreakGlassHealth(healthUrl, {
    expectedMode = BREAK_GLASS_MODES.DISABLED,
    expectedEnabled = false,
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

        const response = await fetchImpl(healthUrl, {
            method: 'GET',
            headers,
            signal: controller ? controller.signal : undefined
        });
        const responseText = await response.text();
        const body = responseText ? JSON.parse(responseText) : {};
        const actualMode = body && body.breakGlass && body.breakGlass.mode
            ? String(body.breakGlass.mode).trim()
            : '';
        const actualEnabled = Boolean(body && body.breakGlass && body.breakGlass.enabled);
        const detailsRestricted = Boolean(body && body.detailsRestricted);
        const success = response.status === 200
            && !detailsRestricted
            && actualMode === expectedMode
            && actualEnabled === expectedEnabled;

        return {
            executed: true,
            skipped: false,
            success,
            statusCode: response.status,
            durationMs: Date.now() - startedAt,
            detailsRestricted,
            breakGlass: {
                mode: actualMode,
                enabled: actualEnabled
            },
            reason: success
                ? `Health endpoint reported break-glass mode ${expectedMode}.`
                : `Expected health endpoint to report break-glass mode ${expectedMode} (${expectedEnabled ? 'enabled' : 'disabled'}).`
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                executed: true,
                skipped: false,
                success: false,
                statusCode: 0,
                durationMs: Date.now() - startedAt,
                detailsRestricted: false,
                breakGlass: {
                    mode: '',
                    enabled: false
                },
                reason: `Health probe timed out after ${timeoutMs}ms.`
            };
        }

        return {
            executed: true,
            skipped: false,
            success: false,
            statusCode: 0,
            durationMs: Date.now() - startedAt,
            detailsRestricted: false,
            breakGlass: {
                mode: '',
                enabled: false
            },
            reason: `Health probe failed: ${error.message}`
        };
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
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

function summarizeBreakGlassDrill(steps = {}) {
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
        failedSteps
    };
}

function buildBreakGlassDrillReport({
    drillEnvironment,
    targetMode,
    startedAt,
    completedAt,
    steps
} = {}) {
    const summary = summarizeBreakGlassDrill(steps);

    return {
        generatedAt: toIsoString(completedAt),
        drillEnvironment: String(drillEnvironment || ''),
        targetMode: String(targetMode || ''),
        success: summary.failedSteps.length === 0
            && Boolean(steps && steps.activate && steps.activate.success)
            && Boolean(steps && steps.reset && steps.reset.success)
            && Boolean(steps && steps.postActivationHealthCheck && steps.postActivationHealthCheck.success)
            && Boolean(steps && steps.postResetHealthCheck && steps.postResetHealthCheck.success),
        summary: {
            overallDurationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
            executedSteps: summary.executedSteps,
            skippedSteps: summary.skippedSteps,
            failedSteps: summary.failedSteps.length
        },
        failures: summary.failedSteps,
        steps
    };
}

async function runBreakGlassDrill(options = {}, {
    env = process.env,
    executeCommandImpl = executeShellCommand,
    probeBreakGlassHealthImpl = probeBreakGlassHealth
} = {}) {
    const resolvedOptions = validateBreakGlassDrillOptions(resolveBreakGlassDrillOptions(options, env));
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

    const prepareFailed = steps.prepare.executed && !steps.prepare.success;
    if (prepareFailed) {
        steps.initialHealthCheck = createSkippedStep('Skipped because the prepare step failed.');
        steps.activate = createSkippedStep('Skipped because the prepare step failed.');
        steps.postActivationHealthCheck = createSkippedStep('Skipped because the prepare step failed.');
        steps.validation = createSkippedStep('Skipped because the prepare step failed.');
        steps.auditValidation = createSkippedStep('Skipped because the prepare step failed.');
        steps.reset = createSkippedStep('Skipped because the prepare step failed.');
        steps.postResetHealthCheck = createSkippedStep('Skipped because the prepare step failed.');
        return buildBreakGlassDrillReport({
            drillEnvironment: resolvedOptions.drillEnvironment,
            targetMode: resolvedOptions.targetMode,
            startedAt,
            completedAt: new Date(),
            steps
        });
    }

    if (resolvedOptions.healthUrl) {
        steps.initialHealthCheck = await probeBreakGlassHealthImpl(resolvedOptions.healthUrl, {
            expectedMode: BREAK_GLASS_MODES.DISABLED,
            expectedEnabled: false,
            timeoutMs: resolvedOptions.httpTimeoutMs,
            bearerToken: resolvedOptions.healthBearerToken
        });
    } else {
        steps.initialHealthCheck = createSkippedStep('No health URL configured.');
    }

    steps.activate = await runCommandStep({
        command: resolvedOptions.activateCommand,
        timeoutMs: resolvedOptions.timeoutMs,
        executeCommandImpl,
        env
    });

    if (steps.activate.executed && !steps.activate.success) {
        steps.postActivationHealthCheck = createSkippedStep('Skipped because the activation step failed.');
        steps.validation = createSkippedStep('Skipped because the activation step failed.');
        steps.auditValidation = createSkippedStep('Skipped because the activation step failed.');
        steps.reset = createSkippedStep('Skipped because the activation step failed.');
        steps.postResetHealthCheck = createSkippedStep('Skipped because the activation step failed.');
        return buildBreakGlassDrillReport({
            drillEnvironment: resolvedOptions.drillEnvironment,
            targetMode: resolvedOptions.targetMode,
            startedAt,
            completedAt: new Date(),
            steps
        });
    }

    if (resolvedOptions.healthUrl) {
        steps.postActivationHealthCheck = await probeBreakGlassHealthImpl(resolvedOptions.healthUrl, {
            expectedMode: resolvedOptions.targetMode,
            expectedEnabled: true,
            timeoutMs: resolvedOptions.httpTimeoutMs,
            bearerToken: resolvedOptions.healthBearerToken
        });
    } else {
        steps.postActivationHealthCheck = createSkippedStep('No health URL configured.');
    }

    if (resolvedOptions.validationCommand) {
        steps.validation = await runCommandStep({
            command: resolvedOptions.validationCommand,
            timeoutMs: resolvedOptions.timeoutMs,
            executeCommandImpl,
            env
        });
    } else {
        steps.validation = createSkippedStep('No break-glass validation command configured.');
    }

    if (resolvedOptions.auditValidationCommand) {
        steps.auditValidation = await runCommandStep({
            command: resolvedOptions.auditValidationCommand,
            timeoutMs: resolvedOptions.timeoutMs,
            executeCommandImpl,
            env
        });
    } else {
        steps.auditValidation = createSkippedStep('No audit validation command configured.');
    }

    steps.reset = await runCommandStep({
        command: resolvedOptions.resetCommand,
        timeoutMs: resolvedOptions.timeoutMs,
        executeCommandImpl,
        env
    });

    if (steps.reset.executed && !steps.reset.success) {
        steps.postResetHealthCheck = createSkippedStep('Skipped because the reset step failed.');
        return buildBreakGlassDrillReport({
            drillEnvironment: resolvedOptions.drillEnvironment,
            targetMode: resolvedOptions.targetMode,
            startedAt,
            completedAt: new Date(),
            steps
        });
    }

    if (resolvedOptions.healthUrl) {
        steps.postResetHealthCheck = await probeBreakGlassHealthImpl(resolvedOptions.healthUrl, {
            expectedMode: BREAK_GLASS_MODES.DISABLED,
            expectedEnabled: false,
            timeoutMs: resolvedOptions.httpTimeoutMs,
            bearerToken: resolvedOptions.healthBearerToken
        });
    } else {
        steps.postResetHealthCheck = createSkippedStep('No health URL configured.');
    }

    return buildBreakGlassDrillReport({
        drillEnvironment: resolvedOptions.drillEnvironment,
        targetMode: resolvedOptions.targetMode,
        startedAt,
        completedAt: new Date(),
        steps
    });
}

function writeBreakGlassDrillReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });
    const options = parseArgs(process.argv.slice(2));
    const report = await runBreakGlassDrill(options);

    if (options.outputFile) {
        const outputPath = writeBreakGlassDrillReport(options.outputFile, report);
        console.log(`Wrote break-glass drill report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (!report.success) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Break-glass drill failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_HTTP_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    buildBreakGlassDrillReport,
    parseArgs,
    probeBreakGlassHealth,
    resolveBreakGlassDrillOptions,
    runBreakGlassDrill,
    validateBreakGlassDrillOptions,
    writeBreakGlassDrillReport
};
