const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV4_EXACT_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
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
    const hasExplicitIpTarget = IPV4_EXACT_REGEX.test(scanTarget);
    const targetIpMismatch = hasExplicitIpTarget && indicators.ips.length > 0 && !indicators.ips.includes(scanTarget);

    if (scanTarget && scanTarget !== 'unknown' && indicators.ips.includes(scanTarget)) {
        reasons.push(`Alert activity references the same target as the scan: ${scan.target}`);
    }

    if (!targetIpMismatch && (alert.type === 'suspicious_path_probe' || alert.type === 'directory_enumeration') && webFindings.length > 0) {
        reasons.push(`Web reconnaissance alert aligns with ${webFindings.length} web-facing scan finding(s)`);
    }

    if (!targetIpMismatch && alert.type === 'failed_login_burst' && authFindings.length > 0) {
        reasons.push(`Failed login activity aligns with ${authFindings.length} authentication-exposed scan finding(s)`);
    }

    if (!targetIpMismatch && alert.type === 'injection_attempt' && webFindings.length > 0) {
        reasons.push('Injection attempts target a service profile that appears in the imported scan');
    }

    if (alert.type === 'scanner_tool_detected' && indicators.tools.includes(normalizeToken(scan.tool))) {
        reasons.push(`Observed scanner tool matches imported ${scan.tool} findings`);
    }

    if (!targetIpMismatch && alert.severity === 'high' && highFindings.length > 0) {
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
    // Index scans to avoid full pairwise S*A work in common cases.
    // Build lightweight augmented scan entries and maps for quick candidate lookup.
    const targetMap = new Map();
    const toolMap = new Map();
    const scansWithWebFindings = new Set();
    const scansWithAuthFindings = new Set();
    const scansWithHighFindings = new Set();

    // keep reference to scans array while building maps
    scans.forEach((scan) => {
        const targetKey = normalizeToken(scan.target || 'unknown');
        const toolKey = normalizeToken(scan.tool || 'unknown');
        const { webFindings, authFindings } = classifyScanSurface(scan.findings || []);
        const highFindings = (scan.findings || []).filter((f) => f.severity === 'high');

        if (!targetMap.has(targetKey)) targetMap.set(targetKey, []);
        targetMap.get(targetKey).push(scan);

        if (!toolMap.has(toolKey)) toolMap.set(toolKey, []);
        toolMap.get(toolKey).push(scan);

        if (webFindings.length > 0) scansWithWebFindings.add(scan);
        if (authFindings.length > 0) scansWithAuthFindings.add(scan);
        if (highFindings.length > 0) scansWithHighFindings.add(scan);

    });

    // For each alert, build a candidate set from indices and run correlation only against candidates.
    const pairwise = [];
    alerts.forEach((alert) => {
        const indicators = collectAlertIndicators(alert);
        const candidateSet = new Set();

        // Match by explicit target/ip indicators
        (indicators.ips || []).forEach((ip) => {
            const key = normalizeToken(ip);
            if (targetMap.has(key)) {
                targetMap.get(key).forEach((s) => candidateSet.add(s));
            }
        });

        // Match by observed scanner/tool
        (indicators.tools || []).forEach((tool) => {
            const key = normalizeToken(tool);
            if (toolMap.has(key)) toolMap.get(key).forEach((s) => candidateSet.add(s));
        });

        // Heuristic matches based on alert type
        if (alert.type === 'suspicious_path_probe' || alert.type === 'injection_attempt') {
            scansWithWebFindings.forEach((s) => candidateSet.add(s));
        }

        if (alert.type === 'failed_login_burst') {
            scansWithAuthFindings.forEach((s) => candidateSet.add(s));
        }

        if (alert.severity === 'high') {
            scansWithHighFindings.forEach((s) => candidateSet.add(s));
        }

        // Fallback: if no candidates found, limit to scans that share any target-like token (cheap heuristic)
        if (candidateSet.size === 0) {
            // try matching alerts' detectedAt window by returning all scans with same normalized target tokens
            (indicators.ips || []).forEach((ip) => {
                const key = normalizeToken(ip);
                if (targetMap.has(key)) targetMap.get(key).forEach((s) => candidateSet.add(s));
            });
        }

        candidateSet.forEach((scan) => {
            const correlation = buildCorrelation(scan, alert);
            if (correlation) pairwise.push(correlation);
        });
    });

    // Group correlations by target to avoid inflated pairwise counts
    const groups = new Map();
    pairwise.forEach((corr) => {
        const targetKey = corr.target || 'unknown';
        if (!groups.has(targetKey)) {
            groups.set(targetKey, []);
        }
        groups.get(targetKey).push(corr);
    });

    // Reduce each group into a single representative correlation
    const grouped = [...groups.entries()].map(([target, items]) => {
        // pick highest-severity then most-recent correlation as representative
        const severityScore = { high: 3, medium: 2, low: 1 };
        items.sort((a, b) => {
            const sd = severityScore[b.severity] - severityScore[a.severity];
            if (sd !== 0) return sd;
            const bt = new Date(b.alert.detectedAt || b.scan.importedAt || 0).getTime();
            const at = new Date(a.alert.detectedAt || a.scan.importedAt || 0).getTime();
            return bt - at;
        });

        const primary = items[0];
        const mergedReasons = unique(items.flatMap((i) => i.rationale || []));
        const mergedIps = unique(items.flatMap((i) => (i.matchedIndicators && i.matchedIndicators.ips) || []));
        const mergedTools = unique(items.flatMap((i) => (i.matchedIndicators && i.matchedIndicators.tools) || []));
        const webFindingCount = items.reduce((s, i) => s + ((i.matchedIndicators && i.matchedIndicators.webFindingCount) || 0), 0);
        const authFindingCount = items.reduce((s, i) => s + ((i.matchedIndicators && i.matchedIndicators.authFindingCount) || 0), 0);
        const highFindingCount = items.reduce((s, i) => s + ((i.matchedIndicators && i.matchedIndicators.highFindingCount) || 0), 0);

        return {
            id: `group-${target}`,
            severity: primary.severity,
            headline: items.length > 1 ? `${items.length} correlated matches for ${target}` : primary.headline,
            target,
            rationale: mergedReasons,
            matchedIndicators: {
                ips: mergedIps,
                tools: mergedTools,
                webFindingCount,
                authFindingCount,
                highFindingCount
            },
            // keep representative scan/alert for display
            scan: primary.scan,
            alert: primary.alert,
            matches: items.length
        };
    });

    // Sort grouped correlations by severity and time
    grouped.sort((left, right) => {
        const severityScore = { high: 3, medium: 2, low: 1 };
        const severityDelta = severityScore[right.severity] - severityScore[left.severity];
        if (severityDelta !== 0) {
            return severityDelta;
        }

        const rightTime = new Date(right.alert.detectedAt || right.scan.importedAt || 0).getTime();
        const leftTime = new Date(left.alert.detectedAt || left.scan.importedAt || 0).getTime();
        return rightTime - leftTime;
    });

    const bounded = grouped.slice(0, limit);
    const overview = buildCorrelationOverview(grouped);

    return {
        overview,
        totalCount: grouped.length,
        correlations: bounded
    };
}

module.exports = {
    buildScanAlertCorrelations,
    buildCorrelationOverview
};
