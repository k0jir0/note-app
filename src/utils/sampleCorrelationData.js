const { analyzeLogText } = require('./logAnalysis');
const { parseScanInput } = require('./scanParser');

const SAMPLE_SCAN_TEXT = `- Nikto v2.1.6
---------------------------------------------------------------------------
+ Target IP:          10.10.10.50
+ Target Hostname:    target.local
+ Target Port:        80
---------------------------------------------------------------------------
+ Server: Apache/2.4.41 (Ubuntu)
+ /admin/: Admin directory found. Directory indexing may be enabled.
+ OSVDB-3233: /icons/README: Apache default file found. This can expose server information.
+ OSVDB-3268: /phpmyadmin/: phpMyAdmin found. This is insecure if accessible publicly.
+ OSVDB-397: HTTP method 'PUT' allows clients to save files on the web server.
+ /config.php: Configuration file found exposed in web root. May contain credentials.
+ X-Powered-By header leaks technology: PHP/7.4.3
---------------------------------------------------------------------------`;

const SAMPLE_LOG_TEXT = [
    '2026-03-13 09:14:10 203.0.113.25 POST /auth/login 401',
    '2026-03-13 09:14:11 203.0.113.25 POST /auth/login 401',
    '2026-03-13 09:14:12 203.0.113.25 POST /auth/login 403',
    '2026-03-13 09:14:13 203.0.113.25 POST /auth/login 401',
    '2026-03-13 09:14:14 203.0.113.25 POST /auth/login 401',
    '2026-03-13 09:14:15 203.0.113.25 POST /auth/login 401',
    '2026-03-13 09:14:20 10.0.0.45 GET /.env 404 Nikto/2.1.6',
    '2026-03-13 09:14:21 10.0.0.45 GET /wp-admin 404 Nikto/2.1.6',
    '2026-03-13 09:14:22 10.0.0.45 GET /phpmyadmin 404 Nikto/2.1.6',
    '2026-03-13 09:14:23 10.0.0.45 GET /.git/config 404 Nikto/2.1.6',
    '2026-03-13 09:14:24 10.0.0.45 GET /etc/passwd 404 Nikto/2.1.6',
    '2026-03-13 09:14:25 10.0.0.45 GET /xmlrpc.php 404 Nikto/2.1.6',
    '2026-03-13 09:14:26 10.0.0.45 GET /cgi-bin/test.cgi 404 Nikto/2.1.6',
    '2026-03-13 09:14:27 10.0.0.45 GET /backup.zip 404 Nikto/2.1.6',
    '2026-03-13 09:14:28 10.0.0.45 GET /.htaccess 404 Nikto/2.1.6',
    '2026-03-13 09:14:29 10.0.0.45 GET /admin 404 Nikto/2.1.6',
    '2026-03-13 09:14:30 198.51.100.77 GET /search?q=%27%20OR%20%271%27=%271 200 Mozilla/5.0',
    '2026-03-13 09:14:31 198.51.100.77 GET /profile?bio=<script>alert(1)</script> 200 Mozilla/5.0'
].join('\n');

function createRelativeDate(baseTime, offsetMinutes) {
    return new Date(baseTime.getTime() + (offsetMinutes * 60 * 1000));
}

function buildSampleCorrelationInputs(baseTime = new Date()) {
    const parsedScan = parseScanInput(SAMPLE_SCAN_TEXT);
    const analysis = analyzeLogText(SAMPLE_LOG_TEXT);

    const scan = {
        _id: 'sample-scan-1',
        target: parsedScan.target,
        tool: parsedScan.tool,
        findings: parsedScan.findings,
        summary: `${parsedScan.tool.toUpperCase()} scan of ${parsedScan.target}: ${parsedScan.findings.length} finding(s)`,
        importedAt: createRelativeDate(baseTime, -8)
    };

    const alerts = analysis.alerts.map((alert, index) => ({
        ...alert,
        _id: `sample-alert-${index + 1}`,
        detectedAt: createRelativeDate(baseTime, -6 + index)
    }));

    return {
        scans: [scan],
        alerts,
        sampleLogText: SAMPLE_LOG_TEXT,
        sampleScanText: SAMPLE_SCAN_TEXT
    };
}

function buildPersistedCorrelationDemo(baseTime = new Date()) {
    const scans = [
        {
            target: '10.10.10.50',
            tool: 'nikto',
            summary: 'NIKTO scan of 10.10.10.50: 3 finding(s), web reconnaissance surface confirmed',
            importedAt: createRelativeDate(baseTime, -5),
            findings: [
                {
                    type: 'misconfiguration',
                    severity: 'high',
                    title: '/admin/: Admin directory found and indexing exposed',
                    details: { port: 80, raw: '/admin/: Admin directory found and indexing exposed' }
                },
                {
                    type: 'vulnerability',
                    severity: 'high',
                    title: '/phpmyadmin/: Public phpMyAdmin instance exposed',
                    details: { port: 80, raw: '/phpmyadmin/: Public phpMyAdmin instance exposed' }
                },
                {
                    type: 'info',
                    severity: 'medium',
                    title: 'X-Powered-By header leaks PHP version',
                    details: { port: 80, raw: 'X-Powered-By: PHP/7.4.3' }
                }
            ]
        },
        {
            target: '10.10.10.60',
            tool: 'nmap',
            summary: 'NMAP scan of 10.10.10.60: 3 finding(s), multiple authentication surfaces exposed',
            importedAt: createRelativeDate(baseTime, -4),
            findings: [
                {
                    type: 'open_port',
                    severity: 'high',
                    title: 'Open port: TCP/3389 (ms-wbt-server)',
                    details: { port: 3389, protocol: 'tcp', service: 'ms-wbt-server' }
                },
                {
                    type: 'open_port',
                    severity: 'medium',
                    title: 'Open port: TCP/22 (ssh)',
                    details: { port: 22, protocol: 'tcp', service: 'ssh' }
                },
                {
                    type: 'misconfiguration',
                    severity: 'medium',
                    title: 'Weak authentication policy observed on remote access service',
                    details: { port: 3389, context: 'rdp login exposed to the internet' }
                }
            ]
        },
        {
            target: '10.10.10.70',
            tool: 'json',
            summary: 'JSON scan import of 10.10.10.70: 3 finding(s), application-layer attack surface confirmed',
            importedAt: createRelativeDate(baseTime, -3),
            findings: [
                {
                    type: 'vulnerability',
                    severity: 'high',
                    title: 'Search endpoint appears vulnerable to SQL injection',
                    details: { port: 443, service: 'https', context: 'search parameter reflected unsafely' }
                },
                {
                    type: 'misconfiguration',
                    severity: 'medium',
                    title: 'Admin panel exposed over HTTPS',
                    details: { port: 443, service: 'https', raw: '/admin panel exposed' }
                },
                {
                    type: 'info',
                    severity: 'medium',
                    title: 'Scanner fingerprint matched in reverse proxy telemetry',
                    details: { port: 443, context: 'scanner activity confirmed' }
                }
            ]
        }
    ];

    const alerts = [
        {
            type: 'suspicious_path_probe',
            severity: 'high',
            summary: 'Suspicious path probing detected against 10.10.10.50',
            detectedAt: createRelativeDate(baseTime, -2),
            details: {
                sourceIps: { '10.10.10.50': 8 },
                sample: [
                    '2026-03-13 11:00:10 10.10.10.50 GET /admin 404 Nikto/2.1.6',
                    '2026-03-13 11:00:11 10.10.10.50 GET /phpmyadmin 404 Nikto/2.1.6',
                    '2026-03-13 11:00:12 10.10.10.50 GET /.env 404 Nikto/2.1.6'
                ]
            }
        },
        {
            type: 'directory_enumeration',
            severity: 'medium',
            summary: 'High 404 rate suggests directory enumeration against 10.10.10.50',
            detectedAt: createRelativeDate(baseTime, -1),
            details: {
                sourceIps: { '10.10.10.50': 12 },
                sample: [
                    '2026-03-13 11:00:13 10.10.10.50 GET /backup.zip 404 Nikto/2.1.6',
                    '2026-03-13 11:00:14 10.10.10.50 GET /.git/config 404 Nikto/2.1.6'
                ]
            }
        },
        {
            type: 'failed_login_burst',
            severity: 'high',
            summary: 'Repeated failed login attempts detected from 10.10.10.60',
            detectedAt: createRelativeDate(baseTime, 0),
            details: {
                ip: '10.10.10.60',
                count: 9,
                threshold: 5,
                sample: [
                    '2026-03-13 11:05:10 10.10.10.60 POST /auth/login 401',
                    '2026-03-13 11:05:11 10.10.10.60 POST /auth/login 403'
                ]
            }
        },
        {
            type: 'injection_attempt',
            severity: 'high',
            summary: 'Possible SQL injection or XSS attempt detected against 10.10.10.70',
            detectedAt: createRelativeDate(baseTime, 1),
            details: {
                sourceIps: { '10.10.10.70': 2 },
                sample: [
                    '2026-03-13 11:10:10 10.10.10.70 GET /search?q=%27%20OR%20%271%27=%271 200 Mozilla/5.0',
                    '2026-03-13 11:10:11 10.10.10.70 GET /profile?bio=<script>alert(1)</script> 200 Mozilla/5.0'
                ]
            }
        },
        {
            type: 'scanner_tool_detected',
            severity: 'medium',
            summary: 'Known scanning tool detected in logs: json',
            detectedAt: createRelativeDate(baseTime, 2),
            details: {
                tools: ['json'],
                sourceIps: { '10.10.10.70': 1 },
                sample: ['2026-03-13 11:10:12 10.10.10.70 GET /admin 200 json-scanner/1.0']
            }
        }
    ];

    return {
        scans,
        alerts,
        targets: scans.map((scan) => scan.target),
        logSummaries: [
            '10.10.10.50: path probing and directory enumeration',
            '10.10.10.60: repeated failed logins against auth services',
            '10.10.10.70: injection attempts and scanner-tool activity'
        ]
    };
}

module.exports = {
    buildPersistedCorrelationDemo,
    buildSampleCorrelationInputs
};
