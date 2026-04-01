const { performance } = require('perf_hooks');

// Patterns copied from src/utils/logAnalysis.js
const STATUS_5XX_REGEX = /\s5\d\d\b/;
const STATUS_404_REGEX = /\s404\b/;
const FAILED_LOGIN_REGEX = /(failed|invalid).*(login|password|auth)|\b401\b|\b403\b/i;
const PROBE_REGEX = /\/wp-admin|\/wp-login|phpmyadmin|\/.env|\/.git|\/etc\/passwd|\/admin\b|\/xmlrpc\.php|\/.htaccess|\/backup|\/shell\.php|\/cmd\.php|\/cgi-bin|config\.php/i;
const SCANNER_UA_REGEX = /nikto|sqlmap|masscan|gobuster|dirbuster|wfuzz|hydra|zgrab|metasploit|nessus|openvas/i;
const INJECTION_REGEX = /union\s+select|'\s*or\s*'1'\s*=\s*'1|;\s*--|<script[\s>]|javascript:/i;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

const extractIp = (line) => {
    const match = line.match(IPV4_REGEX);
    return match ? match[0] : 'unknown';
};

// Single-pass aggregator (mirrors aggregateLines)
function singlePass(lines) {
    const failedByIp = new Map();
    const probeLines = [];
    const probeSourceIps = {};
    const scannerLines = [];
    const scannerTools = new Set();
    const injectionLines = [];
    const injectionSourceIps = {};
    let errorCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
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
        if (STATUS_5XX_REGEX.test(line)) errorCount += 1;
        if (STATUS_404_REGEX.test(line)) notFoundCount += 1;
    }

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
}

// Multi-pass implementation that filters separately (simulates previous approach)
function multiPass(lines) {
    const failedLines = lines.filter((l) => FAILED_LOGIN_REGEX.test(l));
    const failedByIp = new Map();
    failedLines.forEach((line) => {
        const ip = extractIp(line);
        failedByIp.set(ip, (failedByIp.get(ip) || 0) + 1);
    });

    const probeLines = lines.filter((l) => PROBE_REGEX.test(l));
    const probeSourceIps = {};
    probeLines.forEach((line) => {
        const ip = extractIp(line);
        probeSourceIps[ip] = (probeSourceIps[ip] || 0) + 1;
    });

    const scannerLines = lines.filter((l) => SCANNER_UA_REGEX.test(l));
    const scannerTools = new Set();
    scannerLines.forEach((line) => {
        const m = line.match(SCANNER_UA_REGEX);
        if (m) scannerTools.add(m[0].toLowerCase());
    });

    const injectionLines = lines.filter((l) => INJECTION_REGEX.test(l));
    const injectionSourceIps = {};
    injectionLines.forEach((line) => {
        const ip = extractIp(line);
        injectionSourceIps[ip] = (injectionSourceIps[ip] || 0) + 1;
    });

    const errorCount = lines.reduce((acc, l) => acc + (STATUS_5XX_REGEX.test(l) ? 1 : 0), 0);
    const notFoundCount = lines.reduce((acc, l) => acc + (STATUS_404_REGEX.test(l) ? 1 : 0), 0);

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
}

// Synthetic log generator
function generateLogLines(total) {
    const lines = new Array(total);
    const ips = ['10.0.0.1', '10.0.0.2', '192.168.1.5', '8.8.8.8', '172.16.0.3'];
    for (let i = 0; i < total; i++) {
    // base line
        let line = `GET /index.html 200 - ${ips[i % ips.length]} - "Mozilla/5.0"`;

        // inject patterns by probability
        const r = Math.random();
        if (r < 0.01) {
            line = `POST /login 401 - ${ips[i % ips.length]} - "Mozilla/5.0" - failed password for user`;
        } else if (r < 0.015) {
            line = `GET /admin 200 - ${ips[i % ips.length]} - "nikto"`;
        } else if (r < 0.02) {
            line = `GET /wp-login.php 200 - ${ips[i % ips.length]} - "Mozilla/5.0"`;
        } else if (r < 0.022) {
            line = `GET /search?q=1' or '1'='1 200 - ${ips[i % ips.length]} - "Mozilla/5.0"`;
        } else if (r < 0.05) {
            line = `GET /page-not-found 404 - ${ips[i % ips.length]} - "Mozilla/5.0"`;
        } else if (r < 0.07) {
            line = `GET /error 500 - ${ips[i % ips.length]} - "Mozilla/5.0"`;
        }

        lines[i] = line;
    }
    return lines;
}

function timeFunction(fn, args, runs = 3) {
    // warmup
    fn(...args);
    const times = [];
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        fn(...args);
        const t1 = performance.now();
        times.push(t1 - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { times, avg };
}

(async () => {
    const TOTAL = 200000; // 200k lines
    console.log('Generating', TOTAL, 'synthetic log lines...');
    const lines = generateLogLines(TOTAL);
    console.log('Done. Running benchmarks...');

    const single = timeFunction(singlePass, [lines], 5);
    console.log('Single-pass times (ms):', single.times.map((t) => t.toFixed(2)) , 'avg:', single.avg.toFixed(2));

    const multi = timeFunction(multiPass, [lines], 5);
    console.log('Multi-pass times (ms):', multi.times.map((t) => t.toFixed(2)) , 'avg:', multi.avg.toFixed(2));

    // sanity: compare some counts
    const sres = singlePass(lines);
    const mres = multiPass(lines);
    console.log('Totals compare:', {
        totalLines: sres.totalLines,
        failedKeys_single: sres.failedByIp.size,
        failedKeys_multi: mres.failedByIp.size,
        probe_single: sres.probeLines.length,
        probe_multi: mres.probeLines.length,
        scanner_single: sres.scannerLines.length,
        scanner_multi: mres.scannerLines.length,
        injection_single: sres.injectionLines.length,
        injection_multi: mres.injectionLines.length,
        errors_single: sres.errorCount,
        errors_multi: mres.errorCount,
        notfound_single: sres.notFoundCount,
        notfound_multi: mres.notFoundCount
    });
})();
