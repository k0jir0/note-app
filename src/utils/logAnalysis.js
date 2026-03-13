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

const buildFailedLoginAlerts = (lines) => {
    const failedByIp = new Map();

    lines.forEach((line) => {
        if (!FAILED_LOGIN_REGEX.test(line)) {
            return;
        }

        const ip = extractIp(line);
        failedByIp.set(ip, (failedByIp.get(ip) || 0) + 1);
    });

    const alerts = [];

    failedByIp.forEach((count, ip) => {
        if (count < 5) {
            return;
        }

        alerts.push({
            type: 'failed_login_burst',
            severity: count >= 10 ? 'high' : 'medium',
            summary: `Repeated failed login attempts detected from ${ip}`,
            details: {
                ip,
                count,
                threshold: 5
            }
        });
    });

    return alerts;
};

const buildPathProbeAlert = (lines) => {
    const probeLines = lines.filter((line) => PROBE_REGEX.test(line));

    if (probeLines.length < 3) {
        return [];
    }

    const sourceIps = {};
    probeLines.forEach((line) => {
        const ip = extractIp(line);
        sourceIps[ip] = (sourceIps[ip] || 0) + 1;
    });

    return [{
        type: 'suspicious_path_probe',
        severity: probeLines.length >= 8 ? 'high' : 'medium',
        summary: 'Suspicious path probing detected in server logs',
        details: {
            count: probeLines.length,
            sourceIps,
            sample: probeLines.slice(0, 3)
        }
    }];
};

const buildErrorRateAlert = (lines) => {
    if (lines.length < 10) {
        return [];
    }

    const errorCount = lines.filter((line) => STATUS_5XX_REGEX.test(line)).length;
    if (errorCount === 0) {
        return [];
    }

    const ratio = errorCount / lines.length;

    if (errorCount < 10 && ratio < 0.2) {
        return [];
    }

    return [{
        type: 'high_error_rate',
        severity: ratio >= 0.35 ? 'high' : 'medium',
        summary: 'High 5xx server error rate detected',
        details: {
            totalLines: lines.length,
            errorCount,
            ratio: Number(ratio.toFixed(2))
        }
    }];
};

const buildScannerToolAlert = (lines) => {
    const scannerLines = lines.filter((line) => SCANNER_UA_REGEX.test(line));

    if (scannerLines.length === 0) {
        return [];
    }

    const toolsFound = new Set();
    scannerLines.forEach((line) => {
        const match = line.match(SCANNER_UA_REGEX);
        if (match) {
            toolsFound.add(match[0].toLowerCase());
        }
    });

    return [{
        type: 'scanner_tool_detected',
        severity: scannerLines.length >= 5 ? 'high' : 'medium',
        summary: `Known scanning tool detected in logs: ${[...toolsFound].join(', ')}`,
        details: {
            count: scannerLines.length,
            tools: [...toolsFound],
            sample: scannerLines.slice(0, 3)
        }
    }];
};

const buildInjectionAttemptAlert = (lines) => {
    const injectionLines = lines.filter((line) => INJECTION_REGEX.test(line));

    if (injectionLines.length === 0) {
        return [];
    }

    const sourceIps = {};
    injectionLines.forEach((line) => {
        const ip = extractIp(line);
        sourceIps[ip] = (sourceIps[ip] || 0) + 1;
    });

    return [{
        type: 'injection_attempt',
        severity: injectionLines.length >= 5 ? 'high' : 'medium',
        summary: 'Possible SQL injection or XSS attempt detected in request logs',
        details: {
            count: injectionLines.length,
            sourceIps,
            sample: injectionLines.slice(0, 3)
        }
    }];
};

const buildDirectoryEnumerationAlert = (lines) => {
    if (lines.length < 10) {
        return [];
    }

    const notFoundCount = lines.filter((line) => STATUS_404_REGEX.test(line)).length;
    if (notFoundCount === 0) {
        return [];
    }

    const ratio = notFoundCount / lines.length;
    if (notFoundCount < 10 && ratio < 0.3) {
        return [];
    }

    return [{
        type: 'directory_enumeration',
        severity: ratio >= 0.5 || notFoundCount >= 30 ? 'high' : 'medium',
        summary: 'High 404 rate suggests directory or file enumeration',
        details: {
            totalLines: lines.length,
            notFoundCount,
            ratio: Number(ratio.toFixed(2))
        }
    }];
};

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
