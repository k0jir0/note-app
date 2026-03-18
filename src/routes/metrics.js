const express = require('express');
const client = require('prom-client');

const router = express.Router();

// Collect default process metrics
client.collectDefaultMetrics({ timeout: 5000 });

// Application metrics
const ingestCounter = new client.Counter({
    name: 'security_realtime_ingest_total',
    help: 'Total realtime ingest requests received',
    labelNames: ['type']
});

const intrusionIngestCounter = new client.Counter({
    name: 'security_intrusion_ingest_total',
    help: 'Total intrusion events ingested',
    labelNames: ['severity']
});

const scanImportCounter = new client.Counter({
    name: 'security_scan_import_total',
    help: 'Total imported scans',
    labelNames: ['tool']
});

const scanFindingsGauge = new client.Gauge({
    name: 'security_scan_findings',
    help: 'Number of findings in the last imported scan',
    labelNames: ['tool']
});

const workerPendingGauge = new client.Gauge({
    name: 'security_worker_pending',
    help: 'Estimated pending messages in the realtime ingest stream'
});

router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (err) {
        res.status(500).end(err && err.message ? err.message : 'metrics error');
    }
});

module.exports = {
    router,
    ingestCounter,
    workerPendingGauge,
    intrusionIngestCounter
    ,
    scanImportCounter,
    scanFindingsGauge
};
