const crypto = require('crypto');
const fs = require('fs/promises');

const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const metrics = require('../routes/metrics');
const blockingService = require('./blockingService');
const notificationService = require('./notificationService');
const { analyzeLogText } = require('../utils/logAnalysis');
const { enrichAlertsForTriage } = require('../utils/alertTriage');
const { parseScanInput } = require('../utils/scanParser');
const { parseFalcoJson } = require('../utils/intrusionParser');

function buildScanSummary(parsedScan) {
    const findings = Array.isArray(parsedScan.findings) ? parsedScan.findings : [];
    const highCount = findings.filter((finding) => finding.severity === 'high').length;
    const mediumCount = findings.filter((finding) => finding.severity === 'medium').length;

    return `${parsedScan.tool.toUpperCase()} scan of ${parsedScan.target}: ${findings.length} finding(s), ${highCount} high, ${mediumCount} medium`;
}

function createContentFingerprint(content) {
    return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

function normalizeInsertedDocs(documents) {
    return Array.isArray(documents) ? documents : [];
}

async function emitInsertedAlertSideEffects(inserted, { notifySummary = false } = {}) {
    try {
        for (const doc of inserted) {
            const sev = doc.severity || 'low';
            metrics.intrusionIngestCounter.inc({ severity: sev }, 1);
        }

        const highAlerts = inserted.filter((doc) => doc.severity === 'high');
        if (highAlerts.length > 0) {
            void blockingService.sendBlockRequestsForAlerts(highAlerts).catch((e) => {
                console.warn('[automation] blocking service failed', e && e.message ? e.message : e);
            });

            if (notifySummary) {
                void notificationService.notifyAlertsSummary(highAlerts).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[automation] metrics/blocking hook failed', e && e.message ? e.message : e);
    }
}

async function readFileSlice(filePath, startPosition, length) {
    const fileHandle = await fs.open(filePath, 'r');

    try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await fileHandle.read(buffer, 0, length, startPosition);
        return buffer.toString('utf8', 0, bytesRead);
    } finally {
        await fileHandle.close();
    }
}

async function persistAutomatedAlerts(config, logText) {
    const analysis = analyzeLogText(logText);
    if (!analysis.alerts.length) {
        return {
            linesAnalyzed: analysis.linesAnalyzed,
            createdAlerts: 0,
            skippedAlerts: 0,
            truncated: analysis.truncated
        };
    }

    const cutoff = config.dedupeWindowMs > 0
        ? new Date(Date.now() - config.dedupeWindowMs)
        : null;
    const existingKeys = new Set();

    if (cutoff) {
        const existingAlerts = await SecurityAlert.find({
            user: config.userId,
            source: config.source,
            detectedAt: { $gte: cutoff }
        }).select('type summary');

        existingAlerts.forEach((alert) => {
            existingKeys.add(`${alert.type}::${alert.summary}`);
        });
    }

    const alertsToCreate = enrichAlertsForTriage(analysis.alerts
        .filter((alert) => !existingKeys.has(`${alert.type}::${alert.summary}`))
        .map((alert) => ({
            ...alert,
            user: config.userId,
            source: config.source,
            detectedAt: new Date()
        })));

    let inserted = [];
    if (alertsToCreate.length > 0) {
        inserted = normalizeInsertedDocs(await SecurityAlert.insertMany(alertsToCreate));
    }

    await emitInsertedAlertSideEffects(inserted);

    return {
        linesAnalyzed: analysis.linesAnalyzed,
        createdAlerts: alertsToCreate.length,
        skippedAlerts: analysis.alerts.length - alertsToCreate.length,
        truncated: analysis.truncated
    };
}

async function persistAutomatedScan(config, rawInput) {
    const trimmedInput = String(rawInput || '').trim();
    if (!trimmedInput) {
        return { created: false, skipped: true, reason: 'empty' };
    }

    const fingerprint = createContentFingerprint(trimmedInput);
    const cutoff = config.dedupeWindowMs > 0
        ? new Date(Date.now() - config.dedupeWindowMs)
        : null;

    if (cutoff) {
        const existingScan = await ScanResult.findOne({
            user: config.userId,
            source: config.source,
            fingerprint,
            importedAt: { $gte: cutoff }
        }).select('_id');

        if (existingScan) {
            return { created: false, skipped: true, reason: 'duplicate', fingerprint };
        }
    }

    const parsedScan = parseScanInput(trimmedInput);
    const scan = await ScanResult.create({
        target: parsedScan.target,
        tool: parsedScan.tool,
        findings: parsedScan.findings,
        summary: buildScanSummary(parsedScan),
        importedAt: new Date(),
        user: config.userId,
        source: config.source,
        fingerprint
    });

    // Metrics: increment scan import counter and set findings gauge
    try {
        const toolLabel = parsedScan.tool || 'unknown';
        metrics.scanImportCounter.inc({ tool: toolLabel }, 1);
        metrics.scanFindingsGauge.set({ tool: toolLabel }, parsedScan.findings.length || 0);
    } catch (e) {
        console.warn('[automation] failed to emit scan metrics', e && e.message ? e.message : e);
    }

    // Notify if there are high severity findings
    try {
        const highFindings = Array.isArray(parsedScan.findings) ? parsedScan.findings.filter((f) => f.severity === 'high') : [];
        if (highFindings.length > 0) {
            void notificationService.notifyScanImport(parsedScan, {
                findingsCount: parsedScan.findings.length,
                summary: buildScanSummary(parsedScan)
            }).catch((e) => console.warn('[automation] notifyScanImport failed', e && e.message ? e.message : e));
        }
    } catch (e) {
        console.warn('[automation] scan notification failed', e && e.message ? e.message : e);
    }
    return {
        created: true,
        skipped: false,
        fingerprint,
        scanId: scan._id,
        findingsCount: parsedScan.findings.length,
        truncated: parsedScan.truncated,
        linesAnalyzed: parsedScan.linesAnalyzed
    };
}

async function persistAutomatedIntrusions(config, rawInput) {
    const trimmedInput = String(rawInput || '').trim();
    if (!trimmedInput) {
        return { created: false, skipped: true, reason: 'empty' };
    }

    const fingerprint = createContentFingerprint(trimmedInput);
    const cutoff = config.dedupeWindowMs > 0
        ? new Date(Date.now() - config.dedupeWindowMs)
        : null;

    if (cutoff) {
        const existing = await SecurityAlert.findOne({
            user: config.userId,
            source: config.source,
            'details._fingerprint': fingerprint,
            detectedAt: { $gte: cutoff }
        }).select('_id');

        if (existing) {
            return { created: false, skipped: true, reason: 'duplicate', fingerprint };
        }
    }

    const parsed = parseFalcoJson(trimmedInput);
    if (!parsed.events || !parsed.events.length) {
        return { created: false, skipped: true, reason: 'no-events', linesAnalyzed: parsed.linesAnalyzed };
    }

    const alertsToCreate = enrichAlertsForTriage(parsed.events.map((ev) => ({
        type: ev.type,
        severity: ev.severity,
        summary: ev.summary,
        details: { ...ev.details, _fingerprint: fingerprint },
        user: config.userId,
        source: config.source,
        detectedAt: new Date()
    })));

    let inserted = [];
    if (alertsToCreate.length > 0) {
        inserted = normalizeInsertedDocs(await SecurityAlert.insertMany(alertsToCreate));
    }

    await emitInsertedAlertSideEffects(inserted, { notifySummary: true });

    return {
        created: true,
        skipped: false,
        fingerprint,
        createdCount: alertsToCreate.length,
        linesAnalyzed: parsed.linesAnalyzed
    };
}

function createLogBatchRunner(config) {
    const state = {
        offset: 0,
        running: false
    };

    return async () => {
        if (state.running) {
            return;
        }

        state.running = true;

        try {
            const stats = await fs.stat(config.filePath);
            if (stats.size <= 0) {
                return;
            }

            if (state.offset > stats.size) {
                state.offset = 0;
            }

            const startPosition = state.offset === 0
                ? Math.max(0, stats.size - config.maxReadBytes)
                : state.offset;
            const length = stats.size - startPosition;

            if (length <= 0) {
                state.offset = stats.size;
                return;
            }

            const logText = await readFileSlice(config.filePath, startPosition, length);
            state.offset = stats.size;

            const result = await persistAutomatedAlerts(config, logText);
            if (result.createdAlerts > 0) {
                console.log(`[automation] log batch created ${result.createdAlerts} alert(s) from ${config.filePath}`);
            }
        } catch (error) {
            console.error(`[automation] log batch failed for ${config.filePath}: ${error.message}`);
        } finally {
            state.running = false;
        }
    };
}

function createScanBatchRunner(config) {
    return createFingerprintBatchRunner({
        config,
        persistFn: persistAutomatedScan,
        getSuccessMessage: (result) => `[automation] scan batch imported ${result.findingsCount} finding(s) from ${config.filePath}`
    });
}

function createIntrusionBatchRunner(config) {
    return createFingerprintBatchRunner({
        config,
        persistFn: persistAutomatedIntrusions,
        getSuccessMessage: (result) => `[automation] intrusion batch created ${result.createdCount} alert(s) from ${config.filePath}`
    });
}

function createFingerprintBatchRunner({ config, persistFn, getSuccessMessage }) {
    const state = {
        lastFingerprint: null,
        lastMtimeMs: 0,
        running: false
    };

    return async () => {
        if (state.running) {
            return;
        }

        state.running = true;

        try {
            const stats = await fs.stat(config.filePath);
            if (stats.mtimeMs === state.lastMtimeMs && state.lastFingerprint) {
                return;
            }

            const rawInput = await fs.readFile(config.filePath, 'utf8');
            const fingerprint = createContentFingerprint(rawInput.trim());

            state.lastMtimeMs = stats.mtimeMs;

            if (fingerprint === state.lastFingerprint) {
                return;
            }

            const result = await persistFn(config, rawInput);
            state.lastFingerprint = fingerprint;

            if (result.created) {
                console.log(getSuccessMessage(result));
            }
        } catch (error) {
            console.error(`[automation] batch failed for ${config.filePath}: ${error.message}`);
        } finally {
            state.running = false;
        }
    };
}

function registerAutomationTask(config, createRunner, stopCallbacks) {
    if (!config || !config.enabled) {
        return;
    }

    const runTask = createRunner(config);
    const timer = setInterval(() => {
        void runTask();
    }, config.intervalMs);

    timer.unref();
    void runTask();
    stopCallbacks.push(() => clearInterval(timer));
}

function startAutomation(automationConfig = {}) {
    const stopCallbacks = [];

    registerAutomationTask(automationConfig.logBatch, createLogBatchRunner, stopCallbacks);
    registerAutomationTask(automationConfig.scanBatch, createScanBatchRunner, stopCallbacks);
    registerAutomationTask(automationConfig.intrusionBatch, createIntrusionBatchRunner, stopCallbacks);

    return {
        stop() {
            stopCallbacks.forEach((stopCallback) => stopCallback());
        }
    };
}

module.exports = {
    buildScanSummary,
    createContentFingerprint,
    persistAutomatedAlerts,
    persistAutomatedScan,
    persistAutomatedIntrusions,
    startAutomation
};
