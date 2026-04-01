const { expect } = require('chai');

const { analyzeLogText } = require('../src/utils/logAnalysis');

describe('Log Analysis Utility', () => {
    it('detects failed login bursts from same IP', () => {
        const logText = [
            '2026-03-12 10:00:01 192.168.1.10 POST /auth/login 401',
            '2026-03-12 10:00:02 192.168.1.10 POST /auth/login 401',
            '2026-03-12 10:00:03 192.168.1.10 POST /auth/login 401',
            '2026-03-12 10:00:04 192.168.1.10 POST /auth/login 403',
            '2026-03-12 10:00:05 192.168.1.10 POST /auth/login 401'
        ].join('\n');

        const result = analyzeLogText(logText);

        expect(result.alerts.some((alert) => alert.type === 'failed_login_burst')).to.equal(true);
    });

    it('detects suspicious path probing', () => {
        const logText = [
            '10.0.0.1 GET /.env 404',
            '10.0.0.2 GET /wp-admin 404',
            '10.0.0.3 GET /phpmyadmin 404'
        ].join('\n');

        const result = analyzeLogText(logText);

        expect(result.alerts.some((alert) => alert.type === 'suspicious_path_probe')).to.equal(true);
    });

    it('returns empty alerts for normal traffic', () => {
        const logText = [
            '10.0.0.2 GET /notes 200',
            '10.0.0.2 GET /notes/123 200',
            '10.0.0.3 GET /notes/new 200'
        ].join('\n');

        const result = analyzeLogText(logText);

        expect(result.alerts).to.have.length(0);
    });

    it('detects known scanner tool user agents', () => {
        const logText = [
            '10.0.0.50 GET /robots.txt 200 "Nikto/2.1.6"',
            '10.0.0.50 GET /.env 404 "Nikto/2.1.6"',
            '10.0.0.50 GET /wp-admin 404 "Nikto/2.1.6"'
        ].join('\n');

        const result = analyzeLogText(logText);

        expect(result.alerts.some((alert) => alert.type === 'scanner_tool_detected')).to.equal(true);
    });

    it('detects SQL injection and XSS attempts in request URLs', () => {
        const logText = [
            `10.0.0.55 GET "/search?q=' UNION SELECT username,password FROM users--" 200`,
            '10.0.0.55 GET "/page?x=<script>alert(1)</script>" 200'
        ].join('\n');

        const result = analyzeLogText(logText);

        expect(result.alerts.some((alert) => alert.type === 'injection_attempt')).to.equal(true);
    });

    it('detects directory enumeration via high 404 rate', () => {
        const lines = Array.from({ length: 15 }, (_, i) => `10.0.0.60 GET /file${i}.php 404`);

        const result = analyzeLogText(lines.join('\n'));

        expect(result.alerts.some((alert) => alert.type === 'directory_enumeration')).to.equal(true);
    });
});
