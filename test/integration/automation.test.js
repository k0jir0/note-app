const assert = require('assert');
const automation = require('../../src/services/automationService');
const SecurityAlert = require('../../src/models/SecurityAlert');
const ScanResult = require('../../src/models/ScanResult');
const metrics = require('../../src/routes/metrics');

describe('Automation integration (unit-stubbed)', function () {
    it('creates intrusion alerts and increments intrusion metrics, and imports scans with metrics', async function () {
    // backup originals
        const origAlertFindOne = SecurityAlert.findOne;
        const origAlertInsertMany = SecurityAlert.insertMany;
        const origScanFindOne = ScanResult.findOne;
        const origScanCreate = ScanResult.create;

        const origIntrusionInc = metrics.intrusionIngestCounter.inc;
        const origScanInc = metrics.scanImportCounter.inc;
        const origScanGauge = metrics.scanFindingsGauge.set;

        try {
            // spies
            const intrusionCalls = [];
            metrics.intrusionIngestCounter.inc = (labels, n) => intrusionCalls.push({ labels, n });

            const scanIncCalls = [];
            metrics.scanImportCounter.inc = (labels, n) => scanIncCalls.push({ labels, n });

            const scanGaugeCalls = [];
            metrics.scanFindingsGauge.set = (labels, value) => scanGaugeCalls.push({ labels, value });

            // stub DB
            SecurityAlert.findOne = async () => null;
            SecurityAlert.insertMany = async (arr) => arr.map((a, i) => ({ ...a, _id: `alert${i}` }));

            ScanResult.findOne = async () => null;
            ScanResult.create = async (obj) => ({ ...obj, _id: 'scan1' });

            // run intrusion ingestion
            const falcoLines = [
                JSON.stringify({ rule: 'nmap-scan', output: 'nmap scan detected', priority: 'critical' }),
                JSON.stringify({ rule: 'ssh-fail', output: 'failed password for root', priority: 'warn' })
            ].join('\n');

            const cfg = { userId: '0123456789abcdef01234567', source: 'test-intrusion', dedupeWindowMs: 0 };
            const res = await automation.persistAutomatedIntrusions(cfg, falcoLines);
            assert.strictEqual(res.created, true);
            assert.strictEqual(res.createdCount, 2);
            assert.strictEqual(intrusionCalls.length, 2);

            // run scan ingestion (JSON)
            const jsonScan = JSON.stringify([{ id: 'v1', severity: 'high', title: 'Critical vuln' }]);
            const scanCfg = { userId: '0123456789abcdef01234567', source: 'test-scan', dedupeWindowMs: 0 };
            const scanRes = await automation.persistAutomatedScan(scanCfg, jsonScan);
            assert.strictEqual(scanRes.created, true);
            assert.strictEqual(scanRes.findingsCount, 1);
            assert.strictEqual(scanIncCalls.length, 1);
            assert.strictEqual(scanGaugeCalls.length, 1);
            assert.strictEqual(scanGaugeCalls[0].value, 1);
        } finally {
            // restore
            SecurityAlert.findOne = origAlertFindOne;
            SecurityAlert.insertMany = origAlertInsertMany;
            ScanResult.findOne = origScanFindOne;
            ScanResult.create = origScanCreate;
            metrics.intrusionIngestCounter.inc = origIntrusionInc;
            metrics.scanImportCounter.inc = origScanInc;
            metrics.scanFindingsGauge.set = origScanGauge;
        }
    });
});
