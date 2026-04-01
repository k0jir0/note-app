const MAX_LOG_TEXT_LENGTH = 200000;

const STATUS_5XX_REGEX = /\s5\d\d\b/;
const STATUS_404_REGEX = /\s404\b/;
const FAILED_LOGIN_REGEX = /(failed|invalid).*(login|password|auth)|\b401\b|\b403\b/i;
const PROBE_REGEX = /\/wp-admin|\/wp-login|phpmyadmin|\/\.env|\/\.git|\/etc\/passwd|\/admin\b|\/xmlrpc\.php|\/\.htaccess|\/backup|\/shell\.php|\/cmd\.php|\/cgi-bin|config\.php/i;
const SCANNER_UA_REGEX = /nikto|sqlmap|masscan|gobuster|dirbuster|wfuzz|hydra|zgrab|metasploit|nessus|openvas/i;
const INJECTION_REGEX = /union\s+select|'\s*or\s*'1'\s*=\s*'1|;\s*--|<script[\s>]|javascript:/i;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

const normalizeLines = (logText) => {
    if (typeof logText !== 'string') {
        return [];
    }

    return logText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
};

const extractIp = (line) => {
    const match = line.match(IPV4_REGEX);
    return match ? match[0] : 'unknown';
};

// Single-pass aggregation to gather indicators and samples for all alert types.
const aggregateLines = (lines) => {
    const failedByIp = new Map();
    const probeLines = [];
    const probeSourceIps = {};
    const scannerLines = [];
    const scannerTools = new Set();
    const injectionLines = [];
    const injectionSourceIps = {};
    let errorCount = 0;
    let notFoundCount = 0;

    lines.forEach((line) => {
        if (FAILED_LOGIN_REGEX.test(line)) {
            const ip = extractIp(line);
            failedByIp.set(ip, (failedByIp.get(ip) || 0) + 1);
        }

        if (PROBE_REGEX.test(line)) {
            probeLines.push(line);
            const ip = extractIp(line);
            probeSourceIps[ip] = (probeSourceIps[ip] || 0) + 1;
        }

        const scannerMatch = line.match(SCANNER_UA_REGEX);
        if (scannerMatch) {
            scannerLines.push(line);
            scannerTools.add(scannerMatch[0].toLowerCase());
        }

        if (INJECTION_REGEX.test(line)) {
            injectionLines.push(line);
            const ip = extractIp(line);
            injectionSourceIps[ip] = (injectionSourceIps[ip] || 0) + 1;
        }

        if (STATUS_5XX_REGEX.test(line)) {
            errorCount += 1;
        }

        if (STATUS_404_REGEX.test(line)) {
            notFoundCount += 1;
        }
    });

    return {
        totalLines: lines.length,
        failedByIp,
        probeLines,
        probeSourceIps,
        scannerLines,
        scannerTools: [...scannerTools],
        injectionLines,
        injectionSourceIps,
        errorCount,
        notFoundCount
    };
};

const buildFailedLoginAlertsFromAgg = (agg) => {
    const alerts = [];
    agg.failedByIp.forEach((count, ip) => {
        if (count < 5) return;
        alerts.push({
            type: 'failed_login_burst',
            severity: count >= 10 ? 'high' : 'medium',
            summary: `Repeated failed login attempts detected from ${ip}`,
            details: { ip, count, threshold: 5 }
        });
    });
    return alerts;
};

const buildPathProbeAlertFromAgg = (agg) => {
    const probeLines = agg.probeLines;
    if (probeLines.length < 3) return [];
    return [{
        type: 'suspicious_path_probe',
        severity: probeLines.length >= 8 ? 'high' : 'medium',
        summary: 'Suspicious path probing detected in server logs',
        details: { count: probeLines.length, sourceIps: agg.probeSourceIps, sample: probeLines.slice(0, 3) }
    }];
};

const buildErrorRateAlertFromAgg = (agg) => {
    if (agg.totalLines < 10) return [];
    const errorCount = agg.errorCount;
    if (errorCount === 0) return [];
    const ratio = errorCount / agg.totalLines;
    if (errorCount < 10 && ratio < 0.2) return [];
    return [{
        type: 'high_error_rate',
        severity: ratio >= 0.35 ? 'high' : 'medium',
        summary: 'High 5xx server error rate detected',
        details: { totalLines: agg.totalLines, errorCount, ratio: Number(ratio.toFixed(2)) }
    }];
};

const buildScannerToolAlertFromAgg = (agg) => {
    if (!agg.scannerLines || agg.scannerLines.length === 0) return [];
    return [{
        type: 'scanner_tool_detected',
        severity: agg.scannerLines.length >= 5 ? 'high' : 'medium',
        summary: `Known scanning tool detected in logs: ${agg.scannerTools.join(', ')}`,
        details: { count: agg.scannerLines.length, tools: agg.scannerTools, sample: agg.scannerLines.slice(0, 3) }
    }];
};

const buildInjectionAttemptAlertFromAgg = (agg) => {
    if (!agg.injectionLines || agg.injectionLines.length === 0) return [];
    return [{
        type: 'injection_attempt',
        severity: agg.injectionLines.length >= 5 ? 'high' : 'medium',
        summary: 'Possible SQL injection or XSS attempt detected in request logs',
        details: { count: agg.injectionLines.length, sourceIps: agg.injectionSourceIps, sample: agg.injectionLines.slice(0, 3) }
    }];
};

const buildDirectoryEnumerationAlertFromAgg = (agg) => {
    if (agg.totalLines < 10) return [];
    const notFoundCount = agg.notFoundCount;
    if (notFoundCount === 0) return [];
    const ratio = notFoundCount / agg.totalLines;
    if (notFoundCount < 10 && ratio < 0.3) return [];
    return [{
        type: 'directory_enumeration',
        severity: ratio >= 0.5 || notFoundCount >= 30 ? 'high' : 'medium',
        summary: 'High 404 rate suggests directory or file enumeration',
        details: { totalLines: agg.totalLines, notFoundCount, ratio: Number(ratio.toFixed(2)) }
    }];
};

// Backwards-compatible wrappers that accept raw lines (useful for tests).
const buildFailedLoginAlerts = (lines) => buildFailedLoginAlertsFromAgg(aggregateLines(lines));
const buildPathProbeAlert = (lines) => buildPathProbeAlertFromAgg(aggregateLines(lines));
const buildErrorRateAlert = (lines) => buildErrorRateAlertFromAgg(aggregateLines(lines));
const buildScannerToolAlert = (lines) => buildScannerToolAlertFromAgg(aggregateLines(lines));
const buildInjectionAttemptAlert = (lines) => buildInjectionAttemptAlertFromAgg(aggregateLines(lines));
const buildDirectoryEnumerationAlert = (lines) => buildDirectoryEnumerationAlertFromAgg(aggregateLines(lines));

const analyzeLogText = (logText) => {
    if (typeof logText !== 'string' || !logText.trim()) {
        return {
            linesAnalyzed: 0,
            alerts: []
        };
    }

    const boundedText = logText.length > MAX_LOG_TEXT_LENGTH
        ? logText.slice(0, MAX_LOG_TEXT_LENGTH)
        : logText;

    const lines = normalizeLines(boundedText);

    const alerts = [
        ...buildFailedLoginAlerts(lines),
        ...buildPathProbeAlert(lines),
        ...buildErrorRateAlert(lines),
        ...buildScannerToolAlert(lines),
        ...buildInjectionAttemptAlert(lines),
        ...buildDirectoryEnumerationAlert(lines)
    ];

    return {
        linesAnalyzed: lines.length,
        truncated: logText.length > MAX_LOG_TEXT_LENGTH,
        alerts
    };
};

module.exports = {
    MAX_LOG_TEXT_LENGTH,
    analyzeLogText,
    buildScannerToolAlert,
    buildInjectionAttemptAlert,
    buildDirectoryEnumerationAlert
};
