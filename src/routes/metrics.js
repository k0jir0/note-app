const express = require('express');
const client = require('prom-client');
const crypto = require('crypto');
const { isAccountDisabled } = require('../services/accountLifecycleService');
const { resolveMissionRole } = require('../services/privilegedRuntimeAccessService');

const router = express.Router();
const PRIVILEGED_METRICS_ROLES = new Set(['admin', 'auditor', 'break_glass']);

function readMetricsAuthToken() {
    const value = String(process.env.METRICS_AUTH_TOKEN || '').trim();
    return value.length > 0 ? value : '';
}

function hasPrivilegedMetricsSession(req) {
    return Boolean(
        req
        && typeof req.isAuthenticated === 'function'
        && req.isAuthenticated()
        && req.user
        && req.user._id
        && !isAccountDisabled(req.user)
        && PRIVILEGED_METRICS_ROLES.has(resolveMissionRole(req.user))
    );
}

function extractMetricsToken(req) {
    const headerValue = req && req.headers
        ? req.headers.authorization || req.headers.Authorization || req.headers['x-metrics-token']
        : '';

    if (typeof headerValue !== 'string') {
        return '';
    }

    const trimmedValue = headerValue.trim();
    const bearerPrefix = 'Bearer ';
    if (trimmedValue.startsWith(bearerPrefix)) {
        return trimmedValue.slice(bearerPrefix.length).trim();
    }

    return trimmedValue;
}

function hasValidMetricsToken(req) {
    const expectedToken = readMetricsAuthToken();
    const presentedToken = extractMetricsToken(req);

    if (!expectedToken || !presentedToken) {
        return false;
    }

    const expectedBuffer = Buffer.from(expectedToken, 'utf8');
    const presentedBuffer = Buffer.from(presentedToken, 'utf8');
    if (expectedBuffer.length !== presentedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
}

function authorizeMetricsRequest(req, res, next) {
    if (hasPrivilegedMetricsSession(req) || hasValidMetricsToken(req)) {
        return next();
    }

    return res.status(401).type('text/plain').send('Unauthorized');
}

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
    help: 'Messages currently pending in the realtime ingest consumer group'
});

router.get('/metrics', authorizeMetricsRequest, async (req, res) => {
    try {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (err) {
        res.status(500).end(err && err.message ? err.message : 'metrics error');
    }
});

module.exports = {
    authorizeMetricsRequest,
    router,
    ingestCounter,
    workerPendingGauge,
    intrusionIngestCounter
    ,
    scanImportCounter,
    scanFindingsGauge
};
