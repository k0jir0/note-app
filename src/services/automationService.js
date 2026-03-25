const fs = require('fs/promises');

const SecurityAlert = require('../models/SecurityAlert');
const metrics = require('../routes/metrics');
const notificationService = require('./notificationService');
const incidentResponseService = require('./incidentResponseService');
const { enrichAlertsForTriage } = require('../utils/alertTriage');
const { parseFalcoJson } = require('../utils/intrusionParser');
const {
    buildScanSummary,
    createContentFingerprint,
    persistLogAnalysis,
    persistScanImport
} = require('./securityIngestService');

function normalizeInsertedDocs(documents) {
    return Array.isArray(documents) ? documents : [];
}

async function emitInsertedAlertSideEffects(inserted, { respondToIncidents = true } = {}) {
    try {
        for (const doc of inserted) {
            const sev = doc.severity || 'low';
            metrics.intrusionIngestCounter.inc({ severity: sev }, 1);
        }

        if (respondToIncidents && inserted.length > 0) {
            await incidentResponseService.executeIncidentResponses(inserted, {
                SecurityAlertModel: SecurityAlert
            });
        }
    } catch (e) {
        console.warn('[automation] metrics/incident-response hook failed', e && e.message ? e.message : e);
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
    return persistLogAnalysis({
        userId: config.userId,
        source: config.source,
        logText,
        dedupeWindowMs: config.dedupeWindowMs,
        respondToIncidents: config.respondToIncidents !== false,
        detectedAt: new Date()
    }, {
        SecurityAlertModel: SecurityAlert,
        ignoreIncidentResponseErrors: true,
        logger: console,
        executeIncidentResponsesFn: async (alerts, options = {}) => {
            const responseOutcome = await incidentResponseService.executeIncidentResponses(alerts, options);
            return responseOutcome;
        }
    });
}

async function persistAutomatedScan(config, rawInput) {
    return persistScanImport({
        userId: config.userId,
        source: config.source,
        rawInput,
        dedupeWindowMs: config.dedupeWindowMs,
        importedAt: new Date()
    }, {
        emitMetrics: true,
        metricsModule: metrics,
        logger: console,
        notifyOnHighFindings: true,
        notifyScanImportFn: notificationService.notifyScanImport
    });
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

    await emitInsertedAlertSideEffects(inserted, {
        respondToIncidents: config.respondToIncidents !== false
    });

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

function registerAutomationTask(config, createRunner, stopCallbacks, options = {}) {
    if (!config || !config.enabled) {
        return;
    }

    const runTask = createRunner(config);
    const timer = setInterval(() => {
        void runTask();
    }, config.intervalMs);

    if (options.unrefTimers && typeof timer.unref === 'function') {
        timer.unref();
    }
    void runTask();
    stopCallbacks.push(() => clearInterval(timer));
}

function startAutomation(automationConfig = {}, options = {}) {
    const stopCallbacks = [];

    registerAutomationTask(automationConfig.logBatch, createLogBatchRunner, stopCallbacks, options);
    registerAutomationTask(automationConfig.scanBatch, createScanBatchRunner, stopCallbacks, options);
    registerAutomationTask(automationConfig.intrusionBatch, createIntrusionBatchRunner, stopCallbacks, options);

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
