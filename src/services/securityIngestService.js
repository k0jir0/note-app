const crypto = require('crypto');

const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const metrics = require('../routes/metrics');
const notificationService = require('./notificationService');
const { executeIncidentResponses } = require('./incidentResponseService');
const { analyzeLogText, MAX_LOG_TEXT_LENGTH } = require('../utils/logAnalysis');
const { enrichAlertsForTriage } = require('../utils/alertTriage');
const { parseScanInput, MAX_SCAN_INPUT_LENGTH } = require('../utils/scanParser');

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

async function emitScanSideEffects(parsedScan, result, options = {}) {
    const {
        emitMetrics = false,
        logger = console,
        metricsModule = metrics,
        notifyOnHighFindings = false,
        notifyScanImportFn = notificationService.notifyScanImport
    } = options;

    if (emitMetrics) {
        try {
            const toolLabel = parsedScan.tool || 'unknown';
            metricsModule.scanImportCounter.inc({ tool: toolLabel }, 1);
            metricsModule.scanFindingsGauge.set({ tool: toolLabel }, parsedScan.findings.length || 0);
        } catch (error) {
            logger.warn?.('[security-ingest] failed to emit scan metrics', error && error.message ? error.message : error);
        }
    }

    if (!notifyOnHighFindings) {
        return;
    }

    try {
        const highFindings = Array.isArray(parsedScan.findings)
            ? parsedScan.findings.filter((finding) => finding.severity === 'high')
            : [];
        if (highFindings.length > 0) {
            void notifyScanImportFn(parsedScan, {
                findingsCount: parsedScan.findings.length,
                summary: result.summary
            }).catch((error) => logger.warn?.('[security-ingest] notifyScanImport failed', error && error.message ? error.message : error));
        }
    } catch (error) {
        logger.warn?.('[security-ingest] scan notification failed', error && error.message ? error.message : error);
    }
}

async function persistLogAnalysis(input, options = {}) {
    const {
        userId,
        source = 'manual-log-input',
        logText = '',
        dedupeWindowMs = 0,
        respondToIncidents = false,
        detectedAt = new Date()
    } = input;

    const {
        SecurityAlertModel = SecurityAlert,
        analyzeLogTextFn = analyzeLogText,
        enrichAlertsForTriageFn = enrichAlertsForTriage,
        executeIncidentResponsesFn = executeIncidentResponses,
        ignoreIncidentResponseErrors = false,
        logger = console
    } = options;

    const analysis = analyzeLogTextFn(logText);
    if (!analysis.alerts.length) {
        return {
            linesAnalyzed: analysis.linesAnalyzed,
            createdAlerts: 0,
            skippedAlerts: 0,
            truncated: analysis.truncated,
            inputLimit: MAX_LOG_TEXT_LENGTH,
            alerts: []
        };
    }

    const cutoff = dedupeWindowMs > 0
        ? new Date(Date.now() - dedupeWindowMs)
        : null;
    const existingKeys = new Set();

    if (cutoff) {
        const existingAlerts = await SecurityAlertModel.find({
            user: userId,
            source,
            detectedAt: { $gte: cutoff }
        }).select('type summary');

        existingAlerts.forEach((alert) => {
            existingKeys.add(`${alert.type}::${alert.summary}`);
        });
    }

    const alertsToCreate = enrichAlertsForTriageFn(analysis.alerts
        .filter((alert) => !existingKeys.has(`${alert.type}::${alert.summary}`))
        .map((alert) => ({
            ...alert,
            user: userId,
            source,
            detectedAt
        })));

    let savedAlerts = [];
    if (alertsToCreate.length > 0) {
        savedAlerts = normalizeInsertedDocs(await SecurityAlertModel.insertMany(alertsToCreate));
        if (respondToIncidents) {
            try {
                const responseOutcome = await executeIncidentResponsesFn(savedAlerts, {
                    SecurityAlertModel
                });
                savedAlerts = responseOutcome && Array.isArray(responseOutcome.alerts)
                    ? responseOutcome.alerts
                    : savedAlerts;
            } catch (error) {
                if (!ignoreIncidentResponseErrors) {
                    throw error;
                }

                logger.warn?.('[security-ingest] incident response hook failed', error && error.message ? error.message : error);
            }
        }
    }

    return {
        linesAnalyzed: analysis.linesAnalyzed,
        createdAlerts: alertsToCreate.length,
        skippedAlerts: analysis.alerts.length - alertsToCreate.length,
        truncated: analysis.truncated,
        inputLimit: MAX_LOG_TEXT_LENGTH,
        alerts: savedAlerts
    };
}

async function persistScanImport(input, options = {}) {
    const {
        userId,
        source = 'manual-scan-input',
        rawInput = '',
        dedupeWindowMs = 0,
        importedAt = new Date()
    } = input;

    const {
        ScanResultModel = ScanResult,
        logger = console,
        parseScanInputFn = parseScanInput
    } = options;

    const trimmedInput = String(rawInput || '').trim();
    if (!trimmedInput) {
        return {
            created: false,
            skipped: true,
            reason: 'empty',
            inputLimit: MAX_SCAN_INPUT_LENGTH
        };
    }

    const fingerprint = createContentFingerprint(trimmedInput);
    const cutoff = dedupeWindowMs > 0
        ? new Date(Date.now() - dedupeWindowMs)
        : null;

    if (cutoff) {
        const existingScan = await ScanResultModel.findOne({
            user: userId,
            source,
            fingerprint,
            importedAt: { $gte: cutoff }
        }).select('_id');

        if (existingScan) {
            return {
                created: false,
                skipped: true,
                reason: 'duplicate',
                fingerprint,
                inputLimit: MAX_SCAN_INPUT_LENGTH
            };
        }
    }

    const parsedScan = parseScanInputFn(trimmedInput);
    const summary = buildScanSummary(parsedScan);
    const scan = await ScanResultModel.create({
        target: parsedScan.target,
        tool: parsedScan.tool,
        findings: parsedScan.findings,
        summary,
        importedAt,
        user: userId,
        source,
        fingerprint
    });

    const result = {
        created: true,
        skipped: false,
        fingerprint,
        scanId: scan._id,
        findingsCount: parsedScan.findings.length,
        truncated: parsedScan.truncated,
        linesAnalyzed: parsedScan.linesAnalyzed,
        inputLimit: MAX_SCAN_INPUT_LENGTH,
        summary,
        scan
    };

    await emitScanSideEffects(parsedScan, result, {
        ...options,
        logger
    });

    return result;
}

module.exports = {
    MAX_LOG_TEXT_LENGTH,
    MAX_SCAN_INPUT_LENGTH,
    buildScanSummary,
    createContentFingerprint,
    persistLogAnalysis,
    persistScanImport
};
