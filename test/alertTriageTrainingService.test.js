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
});
