const { expect } = require('chai');
const mongoose = require('mongoose');
const sinon = require('sinon');

const playwrightResearchService = require('../../src/services/playwrightResearchService');
const seleniumResearchService = require('../../src/services/seleniumResearchService');
const {
    TEST_USER_ID,
    TestClient,
    closeServer,
    createApp,
    createStores,
    stubNotesModel,
    stubSecurityModels
} = require('../support/appFlowsTestSupport');

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
        expect(researchHtml).to.include('Self-Healing Module');
        expect(researchHtml).to.include('Hardware-First MFA Module');
        expect(researchHtml).to.include('Mission Assurance Module');
        expect(researchHtml).to.include('/ml/module');
        expect(researchHtml).to.include('/selenium/module');
        expect(researchHtml).to.include('/playwright/module');
        expect(researchHtml).to.include('/self-healing/module');
        expect(researchHtml).to.include('/hardware-mfa/module');
        expect(researchHtml).to.include('/mission-assurance/module');

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
        expect(seleniumHtml).to.include('Latest Suite Run');
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
        expect(seleniumOverviewPayload.data.coverage.scenarioCount).to.equal(seleniumResearchService.getScenarioIds().length);
        expect(seleniumOverviewPayload.data.suite.implementedScenarioCount).to.equal(seleniumResearchService.getScenarioIds().length);
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
        expect(seleniumScriptPayload.data.content).to.include('/self-healing/module');
        expect(seleniumScriptPayload.data.content).to.include('/hardware-mfa/module');
        expect(seleniumScriptPayload.data.content).to.include('/mission-assurance/module');

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
        expect(playwrightScriptPayload.data.content).to.include('/hardware-mfa/module');
        expect(playwrightScriptPayload.data.content).to.include('/mission-assurance/module');

        const legacyLocatorRepairPage = await client.request('/locator-repair/module', {
            headers: { 'x-test-auth': '1' }
        });
        expect(legacyLocatorRepairPage.status).to.equal(302);
        expect(legacyLocatorRepairPage.headers.get('location')).to.equal('/self-healing/module');

        const locatorRepairPage = await client.request('/self-healing/module', {
            headers: { 'x-test-auth': '1' }
        });
        const locatorRepairHtml = await locatorRepairPage.text();

        expect(locatorRepairPage.status).to.equal(200);
        expect(locatorRepairHtml).to.include('Self-Healing Module');
        expect(locatorRepairHtml).to.include('/api/locator-repair/overview');
        expect(locatorRepairHtml).to.include('/api/locator-repair/history');
        expect(locatorRepairHtml).to.include('/api/locator-repair/suggest');
        expect(locatorRepairHtml).to.include('/api/locator-repair/feedback');
        expect(locatorRepairHtml).to.include('/api/locator-repair/train');
        expect(locatorRepairHtml).to.include('Suggest Repairs');
        expect(locatorRepairHtml).to.include('Train Model');

        const locatorRepairOverviewResponse = await client.request('/api/locator-repair/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const locatorRepairOverviewPayload = await locatorRepairOverviewResponse.json();

        expect(locatorRepairOverviewResponse.status).to.equal(200);
        expect(locatorRepairOverviewPayload.success).to.equal(true);
        expect(locatorRepairOverviewPayload.data.module.name).to.equal('Self-Healing Module');
        expect(locatorRepairOverviewPayload.data.coverage.sampleCaseCount).to.be.greaterThan(0);
        expect(locatorRepairOverviewPayload.data.defaultSampleId).to.be.a('string').and.not.equal('');
        expect(locatorRepairOverviewPayload.data.model.available).to.equal(true);

        const locatorRepairCsrfToken = await client.getCsrfToken();
        const locatorRepairSuggestResponse = await client.request('/api/locator-repair/suggest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': locatorRepairCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                locator: 'By.linkText("Open ML Module")',
                stepGoal: 'Open the ML Module from the Research Workspace',
                htmlSnippet: '<a href="/ml/module" data-testid="research-open-ml">Open ML Workspace</a>'
            })
        });
        const locatorRepairSuggestPayload = await locatorRepairSuggestResponse.json();

        expect(locatorRepairSuggestResponse.status).to.equal(200);
        expect(locatorRepairSuggestPayload.success).to.equal(true);
        expect(locatorRepairSuggestPayload.data.analysis.locatorFamily).to.equal('selenium-link-text');
        expect(locatorRepairSuggestPayload.data.suggestions[0].primaryLocator.strategy).to.equal('data-testid');
        expect(locatorRepairSuggestPayload.data.suggestions[0].primaryLocator.playwright).to.include('research-open-ml');
        expect(locatorRepairSuggestPayload.data.suggestions[0].primaryLocator.selenium).to.include('research-open-ml');

        const locatorRepairFeedbackResponse = await client.request('/api/locator-repair/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': locatorRepairCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                locator: 'By.linkText("Open ML Module")',
                stepGoal: 'Open the ML Module from the Research Workspace',
                htmlSnippet: '<a href="/ml/module" data-testid="research-open-ml">Open ML Workspace</a>',
                selectedFingerprint: locatorRepairSuggestPayload.data.suggestions[0].candidate.fingerprint,
                feedbackLabel: 'accepted',
                framework: 'integration'
            })
        });
        const locatorRepairFeedbackPayload = await locatorRepairFeedbackResponse.json();

        expect(locatorRepairFeedbackResponse.status).to.equal(200);
        expect(locatorRepairFeedbackPayload.success).to.equal(true);
        expect(locatorRepairFeedbackPayload.data.history.summary.totalEntries).to.be.greaterThan(0);

        const locatorRepairHistoryResponse = await client.request('/api/locator-repair/history', {
            headers: { 'x-test-auth': '1' }
        });
        const locatorRepairHistoryPayload = await locatorRepairHistoryResponse.json();

        expect(locatorRepairHistoryResponse.status).to.equal(200);
        expect(locatorRepairHistoryPayload.success).to.equal(true);
        expect(locatorRepairHistoryPayload.data.summary.totalEntries).to.be.greaterThan(0);

        const locatorRepairTrainResponse = await client.request('/api/locator-repair/train', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': locatorRepairCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                mode: 'bootstrap'
            })
        });
        const locatorRepairTrainPayload = await locatorRepairTrainResponse.json();

        expect(locatorRepairTrainResponse.status).to.equal(200);
        expect(locatorRepairTrainPayload.success).to.equal(true);
        expect(locatorRepairTrainPayload.data.model.available).to.equal(true);

        const hardwareMfaPage = await client.request('/hardware-mfa/module', {
            headers: { 'x-test-auth': '1' }
        });
        const hardwareMfaHtml = await hardwareMfaPage.text();

        expect(hardwareMfaPage.status).to.equal(200);
        expect(hardwareMfaHtml).to.include('Hardware-First MFA Module');
        expect(hardwareMfaHtml).to.include('/api/hardware-mfa/overview');
        expect(hardwareMfaHtml).to.include('/api/hardware-mfa/challenge');
        expect(hardwareMfaHtml).to.include('/api/hardware-mfa/verify');
        expect(hardwareMfaHtml).to.include('/api/hardware-mfa/revoke');
        expect(hardwareMfaHtml).to.include('Challenge And Verify');
        expect(hardwareMfaHtml).to.include('PKI');

        const hardwareMfaOverviewResponse = await client.request('/api/hardware-mfa/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const hardwareMfaOverviewPayload = await hardwareMfaOverviewResponse.json();

        expect(hardwareMfaOverviewResponse.status).to.equal(200);
        expect(hardwareMfaOverviewPayload.success).to.equal(true);
        expect(hardwareMfaOverviewPayload.data.module.name).to.equal('Hardware-First MFA Module');
        expect(hardwareMfaOverviewPayload.data.registeredAuthenticators).to.have.length(2);
        expect(hardwareMfaOverviewPayload.data.sessionAssurance.hardwareFirst).to.equal(false);

        const hardwareMfaCsrfToken = await client.getCsrfToken();
        const hardwareMfaChallengeResponse = await client.request('/api/hardware-mfa/challenge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': hardwareMfaCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                method: 'pki_certificate'
            })
        });
        const hardwareMfaChallengePayload = await hardwareMfaChallengeResponse.json();

        expect(hardwareMfaChallengeResponse.status).to.equal(200);
        expect(hardwareMfaChallengePayload.success).to.equal(true);
        expect(hardwareMfaChallengePayload.data.challengeId).to.match(/^mfa-/);

        const hardwareMfaVerifyResponse = await client.request('/api/hardware-mfa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': hardwareMfaCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                method: 'pki_certificate',
                challengeId: hardwareMfaChallengePayload.data.challengeId,
                responseValue: 'CN=tester@example.com, OU=CAF Research'
            })
        });
        const hardwareMfaVerifyPayload = await hardwareMfaVerifyResponse.json();

        expect(hardwareMfaVerifyResponse.status).to.equal(200);
        expect(hardwareMfaVerifyPayload.success).to.equal(true);
        expect(hardwareMfaVerifyPayload.data.hardwareFirst).to.equal(true);
        expect(hardwareMfaVerifyPayload.data.method).to.equal('pki_certificate');

        const hardwareMfaRefreshedOverviewResponse = await client.request('/api/hardware-mfa/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const hardwareMfaRefreshedOverviewPayload = await hardwareMfaRefreshedOverviewResponse.json();

        expect(hardwareMfaRefreshedOverviewResponse.status).to.equal(200);
        expect(hardwareMfaRefreshedOverviewPayload.data.sessionAssurance.hardwareFirst).to.equal(true);
        expect(hardwareMfaRefreshedOverviewPayload.data.currentProfile.mfaMethod).to.equal('pki_certificate');

        const hardwareMfaRevokeResponse = await client.request('/api/hardware-mfa/revoke', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': hardwareMfaCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({})
        });
        const hardwareMfaRevokePayload = await hardwareMfaRevokeResponse.json();

        expect(hardwareMfaRevokeResponse.status).to.equal(200);
        expect(hardwareMfaRevokePayload.success).to.equal(true);
        expect(hardwareMfaRevokePayload.data.hardwareFirst).to.equal(false);

        const missionAssurancePage = await client.request('/mission-assurance/module', {
            headers: { 'x-test-auth': '1' }
        });
        const missionAssuranceHtml = await missionAssurancePage.text();

        expect(missionAssurancePage.status).to.equal(200);
        expect(missionAssuranceHtml).to.include('Mission Assurance Module');
        expect(missionAssuranceHtml).to.include('/api/mission-assurance/overview');
        expect(missionAssuranceHtml).to.include('/api/mission-assurance/evaluate');
        expect(missionAssuranceHtml).to.include('Policy Decision');
        expect(missionAssuranceHtml).to.include('RBAC');
        expect(missionAssuranceHtml).to.include('ABAC');

        const missionAssuranceOverviewResponse = await client.request('/api/mission-assurance/overview', {
            headers: { 'x-test-auth': '1' }
        });
        const missionAssuranceOverviewPayload = await missionAssuranceOverviewResponse.json();

        expect(missionAssuranceOverviewResponse.status).to.equal(200);
        expect(missionAssuranceOverviewPayload.success).to.equal(true);
        expect(missionAssuranceOverviewPayload.data.module.name).to.equal('Mission Assurance Module');
        expect(missionAssuranceOverviewPayload.data.currentProfile.missionRole).to.equal('analyst');
        expect(missionAssuranceOverviewPayload.data.actions).to.be.an('array').that.is.not.empty;
        expect(missionAssuranceOverviewPayload.data.resources).to.be.an('array').that.is.not.empty;
        expect(missionAssuranceOverviewPayload.data.personas).to.be.an('array').that.is.not.empty;

        const missionAssuranceCsrfToken = await client.getCsrfToken();
        const missionAssuranceEvaluateResponse = await client.request('/api/mission-assurance/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': missionAssuranceCsrfToken,
                'x-test-auth': '1'
            },
            body: JSON.stringify({
                personaId: 'mission-lead',
                actionId: 'approve_block_action',
                resourceId: 'autonomy-block-policy',
                context: {
                    networkZone: 'mission'
                }
            })
        });
        const missionAssuranceEvaluatePayload = await missionAssuranceEvaluateResponse.json();

        expect(missionAssuranceEvaluateResponse.status).to.equal(200);
        expect(missionAssuranceEvaluatePayload.success).to.equal(true);
        expect(missionAssuranceEvaluatePayload.data.allowed).to.equal(true);
        expect(missionAssuranceEvaluatePayload.data.decision).to.equal('allow');
        expect(missionAssuranceEvaluatePayload.data.failedChecks).to.have.length(0);
    });
});
