// Simple Falco JSON parser: converts Falco JSON lines into normalized event objects
function mapPriorityToSeverity(priority) {
    if (!priority) return 'low';
    const p = String(priority).toLowerCase();
    if (p.includes('crit') || p.includes('err') || p.includes('alert') || p.includes('emerg')) return 'high';
    if (p.includes('warn')) return 'medium';
    return 'low';
}

function mapRuleToType(rule, output) {
    const r = String(rule || '').toLowerCase();
    const o = String(output || '').toLowerCase();

    if (r.includes('scan') || r.includes('nmap') || r.includes('port') || o.includes('nmap')) return 'scanner_tool_detected';
    if (r.includes('login') || r.includes('ssh') || r.includes('auth') || o.includes('failed password')) return 'failed_login_burst';
    if (r.includes('dir') || r.includes('enumeration') || r.includes('path') || o.includes('dir') || o.includes('enumeration')) return 'directory_enumeration';
    if (r.includes('exec') || r.includes('shell') || r.includes('command') || o.includes('exec')) return 'injection_attempt';
    if (r.includes('error') || o.includes('error')) return 'high_error_rate';

    return 'suspicious_path_probe';
}

function parseFalcoJson(rawInput) {
    const text = String(rawInput || '').trim();
    if (!text) return { events: [], truncated: false, linesAnalyzed: 0 };

    const events = [];
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            const output = obj.output || obj.rule || obj.message || '';
            const rule = obj.rule || obj.output || '';
            const priority = obj.priority || obj.priority_name || obj.level || obj.priority_name;

            const severity = mapPriorityToSeverity(priority);
            const type = mapRuleToType(rule, output);
            const summary = String(output).slice(0, 200);

            events.push({ type, severity, summary, details: obj });
        } catch (e) {
            // ignore unparsable lines
        }
    }

    return { events, truncated: false, linesAnalyzed: lines.length };
}

module.exports = { parseFalcoJson };
