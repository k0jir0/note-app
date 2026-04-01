const { expect } = require('chai');
const sinon = require('sinon');

const SecurityAlert = require('../src/models/SecurityAlert');
const {
    buildAlertTriageModuleOverview
} = require('../src/services/alertTriageTrainingService');

describe('Alert triage training service', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('counts autonomous-response outcomes using the stored alert source', async () => {
        sinon.stub(SecurityAlert, 'find')
            .onFirstCall()
            .returns({
                select: () => ({
                    sort: () => ({
                        lean: async () => ([
                            {
                                _id: 'alert-1',
                                type: 'injection_attempt',
                                severity: 'high',
                                summary: 'Synthetic autonomy test alert',
                                source: 'realtime-ingest',
                                details: { ip: '203.0.113.90', count: 9, sourceIps: { '203.0.113.90': 9 } },
                                feedback: { label: 'important', updatedAt: new Date('2026-03-21T12:00:00.000Z') },
                                mlScore: 0.96,
                                mlLabel: 'high',
                                mlReasons: ['High-confidence autonomy test'],
                                scoreSource: 'trained-logistic-regression',
                                response: {
                                    level: 'notify',
                                    actions: [
                                        {
                                            type: 'notify',
                                            status: 'sent'
                                        }
                                    ]
                                },
                                detectedAt: new Date('2026-03-21T12:00:00.000Z')
                            }
                        ])
                    })
                })
            })
            .onSecondCall()
            .returns({
                select: () => ({
                    sort: () => ({
                        lean: () => ({
                            limit: async () => []
                        })
                    })
                })
            });

        const overview = await buildAlertTriageModuleOverview({
            userId: 'user-overview'
        });

        expect(overview.autonomy.eligibleAlertCount).to.equal(1);
        expect(overview.autonomy.evaluatedAlertCount).to.equal(1);
        expect(overview.autonomy.notifyDecisionCount).to.equal(1);
        expect(overview.autonomy.blockDecisionCount).to.equal(0);
    });

    it('summarizes configured providers and autonomous action outcomes for eligible alerts', async () => {
        sinon.stub(SecurityAlert, 'find')
            .onFirstCall()
            .returns({
                select: () => ({
                    sort: () => ({
                        lean: async () => ([
                            {
                                _id: 'alert-2',
                                type: 'injection_attempt',
                                severity: 'high',
                                summary: 'Synthetic block-path alert',
                                source: 'realtime-ingest',
                                details: { ip: '203.0.113.44', count: 12, sourceIps: { '203.0.113.44': 12 } },
                                feedback: { label: 'important', updatedAt: new Date('2026-03-21T12:05:00.000Z') },
                                mlScore: 0.98,
                                mlLabel: 'high',
                                mlReasons: ['High-confidence block path'],
                                scoreSource: 'trained-logistic-regression',
                                response: {
                                    level: 'block',
                                    actions: [
                                        {
                                            type: 'notify',
                                            status: 'sent'
                                        },
                                        {
                                            type: 'block',
                                            status: 'failed'
                                        }
                                    ]
                                },
                                detectedAt: new Date('2026-03-21T12:05:00.000Z')
                            },
                            {
                                _id: 'alert-3',
                                type: 'scanner_tool_detected',
                                severity: 'medium',
                                summary: 'Ineligible manual demo alert',
                                source: 'manual-demo',
                                details: { ip: '198.51.100.8', count: 3, sourceIps: { '198.51.100.8': 3 } },
                                feedback: { label: 'unreviewed', updatedAt: new Date('2026-03-21T12:03:00.000Z') },
                                mlScore: 0.55,
                                mlLabel: 'medium',
                                mlReasons: ['Not eligible for autonomous response'],
                                scoreSource: 'trained-logistic-regression',
                                response: {
                                    level: 'notify',
                                    actions: [
                                        {
                                            type: 'notify',
                                            status: 'sent'
                                        }
                                    ]
                                },
                                detectedAt: new Date('2026-03-21T12:03:00.000Z')
                            }
                        ])
                    })
                })
            })
            .onSecondCall()
            .returns({
                select: () => ({
                    sort: () => ({
                        lean: () => ({
                            limit: async () => []
                        })
                    })
                })
            });

        const overview = await buildAlertTriageModuleOverview({
            userId: 'user-overview',
            env: {
                AUTONOMOUS_RESPONSE_ENABLED: 'true',
                AUTONOMOUS_RESPONSE_ALLOWED_SOURCES: 'realtime-ingest',
                SLACK_WEBHOOK_URL: 'https://hooks.slack.test/example',
                SMTP_HOST: 'smtp.example.com',
                ALERT_EMAIL_TO: 'alerts@example.com',
                BLOCK_WEBHOOK_URL: 'https://block.example.com',
                BLOCK_WEBHOOK_SECRET: 'top-secret'
            }
        });

        expect(overview.autonomy.eligibleAlertCount).to.equal(1);
        expect(overview.autonomy.evaluatedAlertCount).to.equal(1);
        expect(overview.autonomy.notifyDecisionCount).to.equal(0);
        expect(overview.autonomy.blockDecisionCount).to.equal(1);
        expect(overview.autonomy.providers.map((provider) => provider.configured)).to.deep.equal([true, true, true]);
        expect(overview.autonomy.levelCounts[0]).to.deep.equal({
            label: 'block',
            count: 1,
            proportion: 1
        });
        expect(overview.autonomy.actionStatusCounts).to.deep.equal([
            {
                label: 'sent',
                count: 1,
                proportion: 0.5
            },
            {
                label: 'failed',
                count: 1,
                proportion: 0.5
            }
        ]);
    });
});
