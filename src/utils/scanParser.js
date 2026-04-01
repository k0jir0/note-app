const MAX_SCAN_INPUT_LENGTH = 300000;

// --- Format detection ---

const detectFormat = (text) => {
    if (/<nmaprun/i.test(text)) {
        return 'nmap';
    }
    if (/nikto v\d/i.test(text)) {
        return 'nikto';
    }
    const trimmed = text.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    return 'text';
};

// --- Port severity classification ---

const HIGH_RISK_PORTS = new Set([21, 23, 3389, 1433, 3306, 5432, 27017, 6379, 9200, 11211]);
const MEDIUM_RISK_PORTS = new Set([22, 25, 53, 110, 143, 445, 139, 8080, 8443, 8888]);

const getPortSeverity = (port) => {
    if (HIGH_RISK_PORTS.has(port)) {
        return 'high';
    }
    if (MEDIUM_RISK_PORTS.has(port)) {
        return 'medium';
    }
    return 'low';
};

// --- Nmap XML parser ---

const parseNmapXml = (text) => {
    const findings = [];
    let target = 'unknown';

    const addrMatch = text.match(/<address[^>]+addr="([^"]+)"/);
    if (addrMatch) {
        target = addrMatch[1];
    }

    const hostnameMatch = text.match(/<hostname[^>]+name="([^"]+)"/);
    if (hostnameMatch) {
        target = hostnameMatch[1];
    }

    const portBlockRegex = /<port\s[^>]*portid="(\d+)"[^>]*>([\s\S]*?)<\/port>/g;
    let portMatch;

    while ((portMatch = portBlockRegex.exec(text)) !== null) {
        const portId = Number(portMatch[1]);
        const portBlock = portMatch[2];

        if (!/<state\s[^>]*state="open"/.test(portBlock)) {
            continue;
        }

        const protoMatch = portMatch[0].match(/protocol="(\w+)"/);
        const proto = protoMatch ? protoMatch[1] : 'tcp';
        const serviceNameMatch = portBlock.match(/<service\s[^>]*name="([^"]*)"/);
        const productMatch = portBlock.match(/product="([^"]*)"/);
        const versionMatch = portBlock.match(/version="([^"]*)"/);

        const service = serviceNameMatch ? serviceNameMatch[1] : '';
        const product = productMatch ? productMatch[1] : '';
        const version = versionMatch ? versionMatch[1] : '';

        const label = service ? ` (${service}${product ? ' / ' + product : ''}${version ? ' ' + version : ''})` : '';

        findings.push({
            type: 'open_port',
            severity: getPortSeverity(portId),
            title: `Open port: ${proto.toUpperCase()}/${portId}${label}`,
            details: { protocol: proto, port: portId, service, product, version }
        });
    }

    return { target, tool: 'nmap', findings };
};

// --- Nikto text parser ---

const NIKTO_SKIP_REGEX = /^\+\s*(?:Target\s|Start Time|End Time|Nikto v|-{3,}|$)/;

const getNiktoSeverity = (content) => {
    if (/\/admin|\/login|shell|cmd\b|exec\b|sql\s*inject|upload/i.test(content)) {
        return 'high';
    }
    if (/OSVDB-\d+|phpmyadmin|backup|config\.|\.htaccess|put\s+method|delete\s+method/i.test(content)) {
        return 'medium';
    }
    return 'low';
};

const getNiktoFindingType = (content) => {
    if (/OSVDB-\d+|CVE-\d|inject|shell|cmd\b|exec\b/i.test(content)) {
        return 'vulnerability';
    }
    if (/default\s+file|default\s+page|server\s+version|X-Powered-By/i.test(content)) {
        return 'misconfiguration';
    }
    return 'info';
};

const parseNiktoText = (text) => {
    const findings = [];
    let target = 'unknown';

    const targetIpMatch = text.match(/\+\s*Target IP:\s+(\S+)/);
    const hostnameMatch = text.match(/\+\s*Target Hostname:\s+(\S+)/);
    if (hostnameMatch) {
        target = hostnameMatch[1];
    } else if (targetIpMatch) {
        target = targetIpMatch[1];
    }

    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('+')) {
            return;
        }
        if (NIKTO_SKIP_REGEX.test(trimmed)) {
            return;
        }

        const content = trimmed.slice(1).trim();
        if (!content) {
            return;
        }

        findings.push({
            type: getNiktoFindingType(content),
            severity: getNiktoSeverity(content),
            title: content.length > 200 ? content.slice(0, 197) + '...' : content,
            details: { raw: content }
        });
    });

    return { target, tool: 'nikto', findings };
};

// --- JSON parser ---

const normalizeJsonSeverity = (value) => {
    const v = String(value || '').toLowerCase();
    if (v === 'high' || v === 'critical') {
        return 'high';
    }
    if (v === 'medium' || v === 'moderate') {
        return 'medium';
    }
    if (v === 'low' || v === 'info' || v === 'informational') {
        return 'low';
    }
    return 'low';
};

const parseJson = (text) => {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (_e) {
        return { target: 'unknown', tool: 'json', findings: [], error: 'Invalid JSON' };
    }

    const rootItems = Array.isArray(parsed)
        ? parsed
        : (parsed.findings || parsed.results || parsed.vulnerabilities || parsed.hosts || [parsed]);

    const findings = rootItems.slice(0, 500).map((item) => ({
        type: item.type || 'info',
        severity: normalizeJsonSeverity(item.severity || item.risk || item.level),
        title: String(item.title || item.name || item.description || item.id || JSON.stringify(item)).slice(0, 200),
        details: item
    }));

    const target = String(parsed.target || parsed.host || parsed.ip || 'unknown');
    return { target, tool: 'json', findings };
};

// --- Generic text fallback parser ---

const OPEN_PORT_LINE_REGEX = /(\d{1,5})\/(tcp|udp)\s+open\s+(\S*)/i;
const CVE_REGEX = /CVE-\d{4}-\d+/gi;

const parseGenericText = (text) => {
    const findings = [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const seenCves = new Set();

    lines.forEach((line) => {
        const portMatch = line.match(OPEN_PORT_LINE_REGEX);
        if (portMatch) {
            const port = Number(portMatch[1]);
            const proto = portMatch[2];
            const service = portMatch[3] || '';
            findings.push({
                type: 'open_port',
                severity: getPortSeverity(port),
                title: `Open port: ${proto.toUpperCase()}/${port}${service ? ` (${service})` : ''}`,
                details: { port, protocol: proto, service }
            });
            return;
        }

        const cveMatches = line.match(CVE_REGEX);
        if (cveMatches) {
            cveMatches.forEach((cve) => {
                if (seenCves.has(cve)) {
                    return;
                }
                seenCves.add(cve);
                findings.push({
                    type: 'vulnerability',
                    severity: 'high',
                    title: `CVE reference: ${cve}`,
                    details: { cve, context: line.slice(0, 200) }
                });
            });
        }
    });

    return { target: 'unknown', tool: 'text', findings };
};

// --- Main export ---

const parseScanInput = (rawText) => {
    if (typeof rawText !== 'string' || !rawText.trim()) {
        return { target: 'unknown', tool: 'text', findings: [], linesAnalyzed: 0, truncated: false };
    }

    const truncated = rawText.length > MAX_SCAN_INPUT_LENGTH;
    const bounded = truncated ? rawText.slice(0, MAX_SCAN_INPUT_LENGTH) : rawText;
    const format = detectFormat(bounded);

    let result;
    if (format === 'nmap') {
        result = parseNmapXml(bounded);
    } else if (format === 'nikto') {
        result = parseNiktoText(bounded);
    } else if (format === 'json') {
        result = parseJson(bounded);
    } else {
        result = parseGenericText(bounded);
    }

    return {
        ...result,
        linesAnalyzed: bounded.split(/\r?\n/).filter(Boolean).length,
        truncated
    };
};

module.exports = {
    parseScanInput,
    MAX_SCAN_INPUT_LENGTH,
    detectFormat,
    getPortSeverity
};
