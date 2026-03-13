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
    '2026-03-13 09:14:20 10.0.0.45 GET /.env 404 Nikto/2.1.6',
    '2026-03-13 09:14:21 10.0.0.45 GET /wp-admin 404 Nikto/2.1.6',
    '2026-03-13 09:14:22 10.0.0.45 GET /phpmyadmin 404 Nikto/2.1.6',
    '2026-03-13 09:14:23 10.0.0.45 GET /.git/config 404 Nikto/2.1.6',
    '2026-03-13 09:14:24 10.0.0.45 GET /etc/passwd 404 Nikto/2.1.6',
    '2026-03-13 09:14:25 10.0.0.45 GET /xmlrpc.php 404 Nikto/2.1.6',
    '2026-03-13 09:14:26 10.0.0.45 GET /cgi-bin/test.cgi 404 Nikto/2.1.6',
    '2026-03-13 09:14:27 10.0.0.45 GET /backup.zip 404 Nikto/2.1.6',
    '2026-03-13 09:14:28 10.0.0.45 GET /.htaccess 404 Nikto/2.1.6',
    '2026-03-13 09:14:29 10.0.0.45 GET /admin 404 Nikto/2.1.6'
].join('\n');

function buildSampleCorrelationInputs() {
    const parsedScan = parseScanInput(SAMPLE_SCAN_TEXT);
    const analysis = analyzeLogText(SAMPLE_LOG_TEXT);

    const scan = {
        _id: 'sample-scan-1',
        target: parsedScan.target,
        tool: parsedScan.tool,
        findings: parsedScan.findings,
        summary: `${parsedScan.tool.toUpperCase()} scan of ${parsedScan.target}: ${parsedScan.findings.length} finding(s)`,
        importedAt: new Date('2026-03-13T09:10:00Z')
    };

    const alerts = analysis.alerts.map((alert, index) => ({
        ...alert,
        _id: `sample-alert-${index + 1}`,
        detectedAt: new Date(`2026-03-13T09:${20 + index}:00Z`)
    }));

    return {
        scans: [scan],
        alerts,
        sampleLogText: SAMPLE_LOG_TEXT,
        sampleScanText: SAMPLE_SCAN_TEXT
    };
}

module.exports = {
    buildSampleCorrelationInputs
};
