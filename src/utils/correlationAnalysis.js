const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const WEB_PORTS = new Set([80, 443, 8080, 8443, 8000, 8888]);
const AUTH_PORTS = new Set([21, 22, 23, 25, 110, 143, 389, 445, 3389, 5900]);

function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
}

function unique(items) {
    return [...new Set(items.filter(Boolean))];
}

function collectAlertIndicators(alert) {
    const details = alert && alert.details ? alert.details : {};
    const sourceIps = details.sourceIps && typeof details.sourceIps === 'object'
        ? Object.keys(details.sourceIps)
        : [];
    const sampleLines = Array.isArray(details.sample) ? details.sample : [];
    const sampleIps = sampleLines.flatMap((line) => {
        const matches = String(line).match(IPV4_REGEX);
        return matches || [];
    });

    return {
        ips: unique([
            details.ip,
            ...(Array.isArray(details.ips) ? details.ips : []),
            ...sourceIps,
            ...sampleIps
        ].map(normalizeToken)),
        tools: unique((Array.isArray(details.tools) ? details.tools : [])
            .map(normalizeToken))
    };
}

function findingText(finding) {
    return normalizeToken([
        finding.title,
        finding.type,
        finding.details && finding.details.service,
        finding.details && finding.details.product,
        finding.details && finding.details.raw,
        finding.details && finding.details.context
    ].filter(Boolean).join(' '));
}

function classifyScanSurface(findings = []) {
    const webFindings = [];
    const authFindings = [];

    findings.forEach((finding) => {
        const port = Number(finding.details && finding.details.port);
        const text = findingText(finding);
        const isWebFinding = WEB_PORTS.has(port)
            || /http|https|admin|login|phpmyadmin|xmlrpc|cgi|config|web|wordpress/.test(text);
        const isAuthFinding = AUTH_PORTS.has(port)
            || /ssh|rdp|ftp|telnet|smtp|imap|pop3|login|auth|admin/.test(text);

        if (isWebFinding) {
            webFindings.push(finding);
        }

        if (isAuthFinding) {
            authFindings.push(finding);
        }
    });

    return { webFindings, authFindings };
}

function deriveReasons(scan, alert) {
    const reasons = [];
    const indicators = collectAlertIndicators(alert);
    const scanTarget = normalizeToken(scan.target);
    const { webFindings, authFindings } = classifyScanSurface(scan.findings || []);
    const highFindings = (scan.findings || []).filter((finding) => finding.severity === 'high');

    if (scanTarget && scanTarget !== 'unknown' && indicators.ips.includes(scanTarget)) {
        reasons.push(`Alert activity references the same target as the scan: ${scan.target}`);
    }

    if ((alert.type === 'suspicious_path_probe' || alert.type === 'directory_enumeration') && webFindings.length > 0) {
        reasons.push(`Web reconnaissance alert aligns with ${webFindings.length} web-facing scan finding(s)`);
    }

    if (alert.type === 'failed_login_burst' && authFindings.length > 0) {
        reasons.push(`Failed login activity aligns with ${authFindings.length} authentication-exposed scan finding(s)`);
    }

    if (alert.type === 'injection_attempt' && webFindings.length > 0) {
        reasons.push('Injection attempts target a service profile that appears in the imported scan');
    }

    if (alert.type === 'scanner_tool_detected' && indicators.tools.includes(normalizeToken(scan.tool))) {
        reasons.push(`Observed scanner tool matches imported ${scan.tool} findings`);
    }

    if (alert.severity === 'high' && highFindings.length > 0) {
        reasons.push(`High-severity alert overlaps with ${highFindings.length} high-severity scan finding(s)`);
    }

    return {
        reasons: unique(reasons),
        indicators,
        webFindings,
        authFindings,
        highFindings
    };
}

function summarizeTopFindings(findings = [], limit = 3) {
    return findings.slice(0, limit).map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        type: finding.type
    }));
}

function buildCorrelation(scan, alert) {
    const { reasons, indicators, webFindings, authFindings, highFindings } = deriveReasons(scan, alert);
    if (reasons.length === 0) {
        return null;
    }

    const severity = (alert.severity === 'high' || highFindings.length > 0)
        ? 'high'
        : (alert.severity === 'medium' || webFindings.length > 0 || authFindings.length > 0 ? 'medium' : 'low');

    return {
        id: `${scan._id || scan.id || scan.target}-${alert._id || alert.id || alert.summary}`,
        severity,
        headline: `${scan.tool.toUpperCase()} findings align with ${alert.type.replaceAll('_', ' ')}`,
        target: scan.target || 'unknown',
        rationale: reasons,
        matchedIndicators: {
            ips: indicators.ips,
            tools: indicators.tools,
            webFindingCount: webFindings.length,
            authFindingCount: authFindings.length,
            highFindingCount: highFindings.length
        },
        scan: {
            id: scan._id,
            tool: scan.tool,
            target: scan.target,
            summary: scan.summary,
            importedAt: scan.importedAt,
            topFindings: summarizeTopFindings(scan.findings || [])
        },
        alert: {
            id: alert._id,
            type: alert.type,
            severity: alert.severity,
            summary: alert.summary,
            detectedAt: alert.detectedAt
        }
    };
}

function buildCorrelationOverview(correlations = []) {
    const targets = new Set();
    let highPriority = 0;

    correlations.forEach((correlation) => {
        if (correlation.target && correlation.target !== 'unknown') {
            targets.add(correlation.target);
        }

        if (correlation.severity === 'high') {
            highPriority += 1;
        }
    });

    return {
        total: correlations.length,
        highPriority,
        targets: targets.size
    };
}

function buildScanAlertCorrelations(scans = [], alerts = [], limit = 20) {
    const correlations = [];

    scans.forEach((scan) => {
        alerts.forEach((alert) => {
            const correlation = buildCorrelation(scan, alert);
            if (correlation) {
                correlations.push(correlation);
            }
        });
    });

    correlations.sort((left, right) => {
        const severityScore = { high: 3, medium: 2, low: 1 };
        const severityDelta = severityScore[right.severity] - severityScore[left.severity];
        if (severityDelta !== 0) {
            return severityDelta;
        }

        const rightTime = new Date(right.alert.detectedAt || right.scan.importedAt || 0).getTime();
        const leftTime = new Date(left.alert.detectedAt || left.scan.importedAt || 0).getTime();
        return rightTime - leftTime;
    });

    const bounded = correlations.slice(0, limit);

    return {
        overview: buildCorrelationOverview(bounded),
        correlations: bounded
    };
}

module.exports = {
    buildScanAlertCorrelations,
    buildCorrelationOverview
};
