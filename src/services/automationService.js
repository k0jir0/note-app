const crypto = require('crypto');
const fs = require('fs/promises');

const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const { analyzeLogText } = require('../utils/logAnalysis');
const { parseScanInput } = require('../utils/scanParser');

function buildScanSummary(parsedScan) {
    const findings = Array.isArray(parsedScan.findings) ? parsedScan.findings : [];
    const highCount = findings.filter((finding) => finding.severity === 'high').length;
    const mediumCount = findings.filter((finding) => finding.severity === 'medium').length;

    return `${parsedScan.tool.toUpperCase()} scan of ${parsedScan.target}: ${findings.length} finding(s), ${highCount} high, ${mediumCount} medium`;
}

function createContentFingerprint(content) {
    return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
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

    const alertsToCreate = analysis.alerts
        .filter((alert) => !existingKeys.has(`${alert.type}::${alert.summary}`))
        .map((alert) => ({
            ...alert,
            user: config.userId,
            source: config.source,
            detectedAt: new Date()
        }));

    if (alertsToCreate.length > 0) {
        await SecurityAlert.insertMany(alertsToCreate);
    }

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

            const result = await persistAutomatedScan(config, rawInput);
            state.lastFingerprint = fingerprint;

            if (result.created) {
                console.log(`[automation] scan batch imported ${result.findingsCount} finding(s) from ${config.filePath}`);
            }
        } catch (error) {
            console.error(`[automation] scan batch failed for ${config.filePath}: ${error.message}`);
        } finally {
            state.running = false;
        }
    };
}

function startAutomation(automationConfig = {}) {
    const stopCallbacks = [];

    if (automationConfig.logBatch && automationConfig.logBatch.enabled) {
        const runLogBatch = createLogBatchRunner(automationConfig.logBatch);
        const logTimer = setInterval(() => {
            void runLogBatch();
        }, automationConfig.logBatch.intervalMs);
        logTimer.unref();
        void runLogBatch();
        stopCallbacks.push(() => clearInterval(logTimer));
    }

    if (automationConfig.scanBatch && automationConfig.scanBatch.enabled) {
        const runScanBatch = createScanBatchRunner(automationConfig.scanBatch);
        const scanTimer = setInterval(() => {
            void runScanBatch();
        }, automationConfig.scanBatch.intervalMs);
        scanTimer.unref();
        void runScanBatch();
        stopCallbacks.push(() => clearInterval(scanTimer));
    }

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
    startAutomation
};
