const { expect } = require('chai');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const sinon = require('sinon');

const noteApiRoutes = require('../../src/routes/noteApiRoutes');
const notePageRoutes = require('../../src/routes/notePageRoutes');
const scanApiRoutes = require('../../src/routes/scanApiRoutes');
const securityApiRoutes = require('../../src/routes/securityApiRoutes');
const securityPageRoutes = require('../../src/routes/securityPageRoutes');
const mlApiRoutes = require('../../src/routes/mlApiRoutes');
const mlPageRoutes = require('../../src/routes/mlPageRoutes');
const playwrightApiRoutes = require('../../src/routes/playwrightApiRoutes');
const playwrightPageRoutes = require('../../src/routes/playwrightPageRoutes');
const seleniumApiRoutes = require('../../src/routes/seleniumApiRoutes');
const seleniumPageRoutes = require('../../src/routes/seleniumPageRoutes');
const playwrightResearchService = require('../../src/services/playwrightResearchService');
const { ensureCsrfToken, requireCsrfProtection } = require('../../src/middleware/csrf');
const Notes = require('../../src/models/Notes');
const SecurityAlert = require('../../src/models/SecurityAlert');
const ScanResult = require('../../src/models/ScanResult');

const TEST_USER_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

function sameValue(left, right) {
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }

    return String(left) === String(right);
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function matchesQuery(document, query = {}) {
    return Object.entries(query).every(([key, expected]) => {
        if (isPlainObject(expected)) {
            return Object.entries(expected).every(([operator, value]) => {
                if (operator === '$gte') {
                    return document[key] >= value;
                }

                return false;
            });
        }

        return sameValue(document[key], expected);
    });
}

function compareValues(left, right) {
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
    }

    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left).localeCompare(String(right));
}

function setNestedValue(target, path, value) {
    const parts = String(path).split('.');
    let current = target;

    while (parts.length > 1) {
        const nextPart = parts.shift();
        if (!current[nextPart] || typeof current[nextPart] !== 'object') {
            current[nextPart] = {};
        }
        current = current[nextPart];
    }

    current[parts[0]] = value;
}

function createQuery(items) {
    let current = [...items];

    const query = {
        select() {
            return query;
        },
        sort(sortSpec = {}) {
            const entries = Object.entries(sortSpec);
            current.sort((left, right) => {
                for (const [field, direction] of entries) {
                    const delta = compareValues(left[field], right[field]);
                    if (delta !== 0) {
                        return direction < 0 ? -delta : delta;
                    }
                }

                return 0;
            });

            return query;
        },
        skip(count = 0) {
            current = current.slice(count);
            return query;
        },
        limit(count) {
            current = current.slice(0, count);
            return query;
        },
        lean() {
            return query;
        },
        then(resolve, reject) {
            return Promise.resolve(current).then(resolve, reject);
        },
        catch(reject) {
            return Promise.resolve(current).catch(reject);
        }
    };

    return query;
}

function createStores() {
    return {
        notes: [],
        alerts: [],
        scans: []
    };
}

function stubNotesModel(sandbox, stores) {
    sandbox.stub(Notes, 'countDocuments').callsFake(async (query = {}) => {
        return stores.notes.filter((note) => matchesQuery(note, query)).length;
    });

    sandbox.stub(Notes, 'find').callsFake((query = {}) => {
        return createQuery(stores.notes.filter((note) => matchesQuery(note, query)));
    });

    sandbox.stub(Notes, 'findOne').callsFake(async (query = {}) => {
        return stores.notes.find((note) => matchesQuery(note, query)) || null;
    });

    sandbox.stub(Notes, 'create').callsFake(async (payload) => {
        const now = new Date();
        const note = {
            _id: new mongoose.Types.ObjectId(),
            title: payload.title,
            content: payload.content || '',
            image: payload.image || '',
            user: payload.user,
            createdAt: now,
            updatedAt: now
        };

        stores.notes.push(note);
        return note;
    });

    sandbox.stub(Notes, 'findOneAndUpdate').callsFake(async (query = {}, update = {}) => {
        const note = stores.notes.find((entry) => matchesQuery(entry, query));
        if (!note) {
            return null;
        }

        Object.assign(note, update, { updatedAt: new Date() });
        return note;
    });

    sandbox.stub(Notes, 'findOneAndDelete').callsFake(async (query = {}) => {
        const index = stores.notes.findIndex((note) => matchesQuery(note, query));
        if (index === -1) {
            return null;
        }

        const [deleted] = stores.notes.splice(index, 1);
        return deleted;
    });
}

function stubSecurityModels(sandbox, stores) {
    sandbox.stub(SecurityAlert, 'countDocuments').callsFake(async (query = {}) => {
        return stores.alerts.filter((alert) => matchesQuery(alert, query)).length;
    });

    sandbox.stub(SecurityAlert, 'find').callsFake((query = {}) => {
        return createQuery(stores.alerts.filter((alert) => matchesQuery(alert, query)));
    });

    sandbox.stub(SecurityAlert, 'insertMany').callsFake(async (payloads = []) => {
        const created = payloads.map((payload) => ({
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        }));

        stores.alerts.push(...created);
        return created;
    });

    sandbox.stub(SecurityAlert, 'findOne').callsFake(async (query = {}) => {
        return stores.alerts.find((alert) => matchesQuery(alert, query)) || null;
    });

    sandbox.stub(SecurityAlert, 'findOneAndUpdate').callsFake(async (query = {}, update = {}) => {
        const alert = stores.alerts.find((entry) => matchesQuery(entry, query));
        if (!alert) {
            return null;
        }

        Object.entries(update).forEach(([key, value]) => {
            if (key.includes('.')) {
                setNestedValue(alert, key, value);
                return;
            }

            alert[key] = value;
        });

        alert.updatedAt = new Date();
        return alert;
    });

    sandbox.stub(SecurityAlert, 'bulkWrite').callsFake(async (operations = []) => {
        operations.forEach((operation) => {
            const updateOne = operation.updateOne || {};
            const alert = stores.alerts.find((entry) => matchesQuery(entry, updateOne.filter || {}));
            if (!alert) {
                return;
            }

            const updateDocument = updateOne.update && updateOne.update.$set
                ? updateOne.update.$set
                : (updateOne.update || {});

            Object.entries(updateDocument).forEach(([key, value]) => {
                alert[key] = value;
            });
        });

        return { modifiedCount: operations.length };
    });

    sandbox.stub(ScanResult, 'countDocuments').callsFake(async (query = {}) => {
        return stores.scans.filter((scan) => matchesQuery(scan, query)).length;
    });

    sandbox.stub(ScanResult, 'find').callsFake((query = {}) => {
        return createQuery(stores.scans.filter((scan) => matchesQuery(scan, query)));
    });

    sandbox.stub(ScanResult, 'create').callsFake(async (payload) => {
        const scan = {
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        };

        stores.scans.push(scan);
        return scan;
    });

    sandbox.stub(ScanResult, 'findOne').callsFake(async (query = {}) => {
        return stores.scans.find((scan) => matchesQuery(scan, query)) || null;
    });

    sandbox.stub(ScanResult, 'insertMany').callsFake(async (payloads = []) => {
        const created = payloads.map((payload) => ({
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        }));

        stores.scans.push(...created);
        return created;
    });
}

function createApp() {
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../src/views'));
    app.locals.runtimeConfig = {
        automation: {
            logBatch: {
                enabled: true,
                source: 'server-log-batch',
                intervalMs: 60000,
                dedupeWindowMs: 300000,
                maxReadBytes: 65536,
                filePath: 'C:\\temp\\e2e-security.log'
            },
            scanBatch: {
                enabled: true,
                source: 'scheduled-scan-import',
                intervalMs: 300000,
                dedupeWindowMs: 3600000,
                filePath: 'C:\\temp\\e2e-scan.txt'
            },
            intrusionBatch: {
                enabled: false
            }
        }
    };
    app.locals.realtimeAvailable = true;
    app.locals.realtimeEnabled = true;

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
        secret: 'test-session-secret-that-is-long-enough',
        resave: false,
        saveUninitialized: true
    }));

    app.use((req, res, next) => {
        const authenticated = req.get('x-test-auth') === '1';
        req.isAuthenticated = () => authenticated;
        req.user = authenticated ? { _id: TEST_USER_ID, email: 'tester@example.com' } : null;
        req.logIn = (user, callback) => {
            req.user = user;
            callback(null);
        };
        req.logout = (callback) => callback(null);
        next();
    });

    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });

    app.use(ensureCsrfToken);
    app.use(requireCsrfProtection);

    app.get('/__test/csrf', (req, res) => {
        res.status(200).json({ csrfToken: res.locals.csrfToken });
    });

    app.use(noteApiRoutes);
    app.use(notePageRoutes);
    app.use(securityApiRoutes);
    app.use(securityPageRoutes);
    app.use(mlApiRoutes);
    app.use(mlPageRoutes);
    app.use(playwrightApiRoutes);
    app.use(playwrightPageRoutes);
    app.use(seleniumApiRoutes);
    app.use(seleniumPageRoutes);
    app.use(scanApiRoutes);

    return app;
}

class TestClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookieHeader = '';
    }

    updateCookies(response) {
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            this.cookieHeader = setCookie.split(';')[0];
        }
    }

    async request(pathname, {
        method = 'GET',
        headers = {},
        body,
        redirect = 'manual'
    } = {}) {
        const finalHeaders = { ...headers };
        if (this.cookieHeader) {
            finalHeaders.Cookie = this.cookieHeader;
        }

        const response = await fetch(`${this.baseUrl}${pathname}`, {
            method,
            headers: finalHeaders,
            body,
            redirect
        });

        this.updateCookies(response);
        return response;
    }

    async getCsrfToken() {
        const response = await this.request('/__test/csrf');
        const payload = await response.json();
        return payload.csrfToken;
    }
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        const forceCloseTimer = setTimeout(() => {
            if (typeof server.closeAllConnections === 'function') {
                server.closeAllConnections();
                return;
            }

            if (typeof server.closeIdleConnections === 'function') {
                server.closeIdleConnections();
            }
        }, 50);

        server.close((error) => {
            clearTimeout(forceCloseTimer);
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });

        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
    });
}

describe('Application end-to-end flows', function () {
    let sandbox;
    let stores;
    let server;
    let baseUrl;
    let client;

    beforeEach(async function () {
        sandbox = sinon.createSandbox();
        stores = createStores();
        stubNotesModel(sandbox, stores);
        stubSecurityModels(sandbox, stores);

        const app = createApp();
        server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });

        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        client = new TestClient(baseUrl);
    });

    afterEach(async function () {
        sandbox.restore();

        if (server) {
            await closeServer(server);
        }
    });

    it('covers authenticated note API CRUD with CSRF protection', async function () {
        const csrfToken = await client.getCsrfToken();

        const unauthorizedResponse = await client.request('/api/notes');
        const unauthorizedPayload = await unauthorizedResponse.json();

        expect(unauthorizedResponse.status).to.equal(401);
        expect(unauthorizedPayload.success).to.equal(false);

        const createResponse = await client.request('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                title: 'E2E API Note',
                content: 'Created through the full notes API flow.',
                image: ''
            })
        });
        const createdPayload = await createResponse.json();

        expect(createResponse.status).to.equal(201);
        expect(createdPayload.success).to.equal(true);
        expect(createdPayload.data.title).to.equal('E2E API Note');

        const noteId = createdPayload.data._id;

        const listResponse = await client.request('/api/notes', {
            headers: { 'x-test-auth': '1' }
        });
        const listPayload = await listResponse.json();

        expect(listResponse.status).to.equal(200);
        expect(listPayload.count).to.equal(1);
        expect(listPayload.data[0].title).to.equal('E2E API Note');

        const updateResponse = await client.request(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                title: 'E2E API Note Updated'
            })
        });
        const updatePayload = await updateResponse.json();

        expect(updateResponse.status).to.equal(200);
        expect(updatePayload.data.title).to.equal('E2E API Note Updated');

        const deleteResponse = await client.request(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            }
        });
        const deletePayload = await deleteResponse.json();

        expect(deleteResponse.status).to.equal(200);
        expect(deletePayload.success).to.equal(true);
        expect(stores.notes).to.have.length(0);
    });

    it('covers the server-rendered note create and edit flow', async function () {
        const csrfToken = await client.getCsrfToken();

        const createResponse = await client.request('/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-test-auth': '1'
            },
            body: new URLSearchParams({
                _csrf: csrfToken,
                title: 'Rendered Flow Note',
                content: 'Created from the HTML form flow.',
                image: ''
            }).toString()
        });

        expect(createResponse.status).to.equal(302);
        expect(createResponse.headers.get('location')).to.equal('/notes');
        expect(stores.notes).to.have.length(1);

        const createdNote = stores.notes[0];

        const listPage = await client.request('/notes', {
            headers: { 'x-test-auth': '1' }
        });
        const listHtml = await listPage.text();

        expect(listPage.status).to.equal(200);
        expect(listHtml).to.include('Rendered Flow Note');
        expect(listHtml).to.include('Created from the HTML form flow.');

        const updateResponse = await client.request(`/notes/${createdNote._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-test-auth': '1'
            },
            body: new URLSearchParams({
                _csrf: csrfToken,
                title: 'Rendered Flow Note Updated',
                content: 'Updated from the HTML form flow.',
                image: ''
            }).toString()
        });

        expect(updateResponse.status).to.equal(302);
        expect(updateResponse.headers.get('location')).to.equal(`/notes/${createdNote._id}`);

        const notePage = await client.request(`/notes/${createdNote._id}`, {
            headers: { 'x-test-auth': '1' }
        });
        const noteHtml = await notePage.text();

        expect(notePage.status).to.equal(200);
        expect(noteHtml).to.include('Rendered Flow Note Updated');
        expect(noteHtml).to.include('Updated from the HTML form flow.');
    });

    it('covers the security module page, log analysis, scan import, correlations, and realtime probe', async function () {
        const csrfToken = await client.getCsrfToken();
        const sampleLog = [
            '2026-03-12 10:14:20 10.10.10.50 GET /.env 404 Nikto/2.1.6',
            '2026-03-12 10:14:21 10.10.10.50 GET /wp-admin 404 Nikto/2.1.6',
            '2026-03-12 10:14:22 10.10.10.50 GET /phpmyadmin 404 Nikto/2.1.6',
            '2026-03-12 10:14:23 10.10.10.50 GET /.git/config 404 Nikto/2.1.6',
            '2026-03-12 10:14:24 10.10.10.50 GET /etc/passwd 404 Nikto/2.1.6',
            '2026-03-12 10:14:25 10.10.10.50 GET /xmlrpc.php 404 Nikto/2.1.6'
        ].join('\n');
        const sampleScan = `- Nikto v2.1.6
---------------------------------------------------------------------------
+ Target IP:          10.10.10.50
+ Target Hostname:    target.local
+ Target Port:        80
---------------------------------------------------------------------------
+ Server: Apache/2.4.41 (Ubuntu)
+ /admin/: Admin directory found. Directory indexing may be enabled.
+ OSVDB-3268: /phpmyadmin/: phpMyAdmin found. This is insecure if accessible publicly.
+ /cgi-bin/test.cgi: CGI script found. Potential code execution risk.
---------------------------------------------------------------------------`;

        const modulePage = await client.request('/security/module', {
            headers: { 'x-test-auth': '1' }
        });
        const moduleHtml = await modulePage.text();

        expect(modulePage.status).to.equal(200);
        expect(moduleHtml).to.include('Security Module');
        expect(moduleHtml).to.include('Server Realtime Enabled');
        expect(moduleHtml).to.include('Stream Disconnected');

        const logResponse = await client.request('/api/security/log-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({ logText: sampleLog })
        });
        const logPayload = await logResponse.json();

        expect(logResponse.status).to.equal(200);
        expect(logPayload.success).to.equal(true);
        expect(logPayload.data.createdAlerts).to.be.greaterThan(0);

        const scanResponse = await client.request('/api/security/scan-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({ rawInput: sampleScan })
        });
        const scanPayload = await scanResponse.json();

        expect(scanResponse.status).to.equal(200);
        expect(scanPayload.success).to.equal(true);
        expect(scanPayload.data.findingsCount).to.be.greaterThan(0);

        const alertsResponse = await client.request('/api/security/alerts?limit=10', {
            headers: { 'x-test-auth': '1' }
        });
        const alertsPayload = await alertsResponse.json();

        expect(alertsResponse.status).to.equal(200);
        expect(alertsPayload.totalCount).to.be.greaterThan(0);
        expect(alertsPayload.data[0]).to.have.property('mlScore');

        const feedbackResponse = await client.request(`/api/security/alerts/${alertsPayload.data[0]._id}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({ feedbackLabel: 'important' })
        });
        const feedbackPayload = await feedbackResponse.json();

        expect(feedbackResponse.status).to.equal(200);
        expect(feedbackPayload.data.feedback.label).to.equal('important');
        expect(feedbackPayload.data.mlScore).to.be.greaterThan(0.9);

        const scansResponse = await client.request('/api/security/scans?limit=10', {
            headers: { 'x-test-auth': '1' }
        });
        const scansPayload = await scansResponse.json();

        expect(scansResponse.status).to.equal(200);
        expect(scansPayload.totalCount).to.equal(1);

        const correlationsResponse = await client.request('/api/security/correlations?limit=10', {
            headers: { 'x-test-auth': '1' }
        });
        const correlationsPayload = await correlationsResponse.json();

        expect(correlationsResponse.status).to.equal(200);
        expect(correlationsPayload.totalCount).to.be.greaterThan(0);
        expect(correlationsPayload.data[0].target).to.be.oneOf(['10.10.10.50', 'target.local']);

        const streamProbe = await client.request('/api/security/stream?probe=1', {
            headers: { 'x-test-auth': '1' }
        });
        const streamProbePayload = await streamProbe.json();

        expect(streamProbe.status).to.equal(200);
        expect(streamProbePayload).to.deep.equal({
            success: true,
            enabled: true
        });
    });

    it('covers the research-page entry point and ML module overview flow', async function () {
        const researchPage = await client.request('/research', {
            headers: { 'x-test-auth': '1' }
        });
        const researchHtml = await researchPage.text();

        expect(researchPage.status).to.equal(200);
        expect(researchHtml).to.include('ML Module');
        expect(researchHtml).to.include('Selenium Module');
        expect(researchHtml).to.include('Playwright Module');
        expect(researchHtml).to.include('/ml/module');
        expect(researchHtml).to.include('/selenium/module');
        expect(researchHtml).to.include('/playwright/module');

        stores.alerts.push({
            _id: new mongoose.Types.ObjectId(),
            type: 'injection_attempt',
            severity: 'high',
            summary: 'Potential SQL injection detected',
            details: { count: 8, sourceIps: { '203.0.113.8': 8 } },
            feedback: { label: 'important', updatedAt: new Date('2026-03-21T12:00:00.000Z') },
            source: 'realtime-ingest',
            response: {
                level: 'notify',
                evaluatedAt: new Date('2026-03-21T12:02:00.000Z'),
                actions: [
                    {
                        type: 'notify',
                        status: 'sent',
                        provider: 'summary-notifier',
                        detail: 'Notification accepted by one configured channel.',
                        recordedAt: new Date('2026-03-21T12:02:00.000Z')
                    }
                ]
            },
            detectedAt: new Date('2026-03-21T12:00:00.000Z'),
            user: TEST_USER_ID
        });

        const mlPage = await client.request('/ml/module', {
            headers: { 'x-test-auth': '1' }
        });
        const mlHtml = await mlPage.text();

        expect(mlPage.status).to.equal(200);
        expect(mlHtml).to.include('ML Module');
        expect(mlHtml).to.include('/api/ml/overview');
        expect(mlHtml).to.include('/api/ml/autonomy-demo');
        expect(mlHtml).to.include('Score Buckets');
        expect(mlHtml).to.include('Alert Types by Priority');
        expect(mlHtml).to.include('Learned Feature Influence');
        expect(mlHtml).to.include('Autonomous Response Loop');
        expect(mlHtml).to.include('Observed Autonomous Outcomes');

        const overviewResponse = await client.request('/api/ml/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const overviewPayload = await overviewResponse.json();

        expect(overviewResponse.status).to.equal(200);
        expect(overviewPayload.success).to.equal(true);
        expect(overviewPayload.data.training.currentUserTrainableCount).to.equal(1);
        expect(overviewPayload.data.alerts.totalCount).to.equal(1);
        expect(overviewPayload.data.alerts.scoreBuckets).to.be.an('array').with.length(4);
        expect(overviewPayload.data.alerts.typePriorityBreakdown[0].label).to.equal('Type: Injection Attempt');
        expect(overviewPayload.data.model.topPositiveFeatures).to.be.an('array');
        expect(overviewPayload.data.alerts.recentAlerts[0].feedback.label).to.equal('important');
        expect(overviewPayload.data.autonomy.enabled).to.equal(true);
        expect(overviewPayload.data.autonomy.eligibleAlertCount).to.equal(1);
        expect(overviewPayload.data.autonomy.notifyDecisionCount).to.equal(1);
        expect(overviewPayload.data.autonomy.levelCounts[0].label).to.equal('notify');

        const csrfToken = await client.getCsrfToken();
        const demoResponse = await client.request('/api/ml/autonomy-demo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({})
        });
        const demoPayload = await demoResponse.json();

        expect(demoResponse.status).to.equal(200);
        expect(demoPayload.success).to.equal(true);
        expect(demoPayload.data.createdAlerts).to.equal(2);
        expect(demoPayload.data.levelCounts.notify).to.equal(1);
        expect(demoPayload.data.levelCounts.block).to.equal(1);

        const refreshedOverviewResponse = await client.request('/api/ml/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const refreshedOverviewPayload = await refreshedOverviewResponse.json();

        expect(refreshedOverviewResponse.status).to.equal(200);
        expect(refreshedOverviewPayload.data.autonomy.eligibleAlertCount).to.equal(3);
        expect(refreshedOverviewPayload.data.autonomy.evaluatedAlertCount).to.equal(3);
        expect(refreshedOverviewPayload.data.autonomy.notifyDecisionCount).to.equal(2);
        expect(refreshedOverviewPayload.data.autonomy.blockDecisionCount).to.equal(1);
        expect(refreshedOverviewPayload.data.autonomy.actionStatusCounts).to.deep.equal([
            {
                label: 'sent',
                count: 1,
                proportion: 0.25
            },
            {
                label: 'skipped',
                count: 3,
                proportion: 0.75
            }
        ]);

        const seleniumPage = await client.request('/selenium/module', {
            headers: { 'x-test-auth': '1' }
        });
        const seleniumHtml = await seleniumPage.text();

        expect(seleniumPage.status).to.equal(200);
        expect(seleniumHtml).to.include('Selenium Module');
        expect(seleniumHtml).to.include('/api/selenium/overview');
        expect(seleniumHtml).to.include('/api/selenium/script');
        expect(seleniumHtml).to.include('Scenario Catalog');
        expect(seleniumHtml).to.include('Generated Script Preview');
        expect(seleniumHtml).to.include('Open Playwright Module');

        const seleniumOverviewResponse = await client.request('/api/selenium/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const seleniumOverviewPayload = await seleniumOverviewResponse.json();

        expect(seleniumOverviewResponse.status).to.equal(200);
        expect(seleniumOverviewPayload.success).to.equal(true);
        expect(seleniumOverviewPayload.data.module.name).to.equal('Selenium Module');
        expect(seleniumOverviewPayload.data.coverage.scenarioCount).to.equal(5);
        expect(seleniumOverviewPayload.data.defaultScenarioId).to.equal('research-full-suite');

        const seleniumScriptResponse = await client.request('/api/selenium/script?scenarioId=research-full-suite', {
            headers: { 'x-test-auth': '1' }
        });
        const seleniumScriptPayload = await seleniumScriptResponse.json();

        expect(seleniumScriptResponse.status).to.equal(200);
        expect(seleniumScriptPayload.success).to.equal(true);
        expect(seleniumScriptPayload.data.fileName).to.equal('selenium-research-full-suite.js');
        expect(seleniumScriptPayload.data.content).to.include('selenium-webdriver');
        expect(seleniumScriptPayload.data.content).to.include('/security/module');
        expect(seleniumScriptPayload.data.content).to.include('/ml/module');
        expect(seleniumScriptPayload.data.content).to.include('/selenium/module');
        expect(seleniumScriptPayload.data.content).to.include('/playwright/module');

        const playwrightPage = await client.request('/playwright/module', {
            headers: { 'x-test-auth': '1' }
        });
        const playwrightHtml = await playwrightPage.text();

        expect(playwrightPage.status).to.equal(200);
        expect(playwrightHtml).to.include('Playwright Module');
        expect(playwrightHtml).to.include('/api/playwright/overview');
        expect(playwrightHtml).to.include('/api/playwright/script');
        expect(playwrightHtml).to.include('Scenario Catalog');
        expect(playwrightHtml).to.include('Generated Spec Preview');

        const playwrightOverviewResponse = await client.request('/api/playwright/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const playwrightOverviewPayload = await playwrightOverviewResponse.json();

        expect(playwrightOverviewResponse.status).to.equal(200);
        expect(playwrightOverviewPayload.success).to.equal(true);
        expect(playwrightOverviewPayload.data.module.name).to.equal('Playwright Module');
        expect(playwrightOverviewPayload.data.coverage.scenarioCount).to.equal(playwrightResearchService.getScenarioIds().length);
        expect(playwrightOverviewPayload.data.defaultScenarioId).to.equal('research-full-suite');

        const playwrightScriptResponse = await client.request('/api/playwright/script?scenarioId=research-full-suite', {
            headers: { 'x-test-auth': '1' }
        });
        const playwrightScriptPayload = await playwrightScriptResponse.json();

        expect(playwrightScriptResponse.status).to.equal(200);
        expect(playwrightScriptPayload.success).to.equal(true);
        expect(playwrightScriptPayload.data.fileName).to.equal('playwright-research-full-suite.spec.js');
        expect(playwrightScriptPayload.data.content).to.include('@playwright/test');
        expect(playwrightScriptPayload.data.content).to.include('/security/module');
        expect(playwrightScriptPayload.data.content).to.include('/ml/module');
        expect(playwrightScriptPayload.data.content).to.include('/selenium/module');
        expect(playwrightScriptPayload.data.content).to.include('/playwright/module');
    });
});
