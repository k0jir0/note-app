const { expect } = require('chai');
const sinon = require('sinon');

const {
    buildIncidentResponseDecision,
    executeIncidentResponses
} = require('../src/services/incidentResponseService');

describe('Incident Response Service', () => {
    const originalNoteKey = process.env.NOTE_ENCRYPTION_KEY;

    before(() => {
        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    afterEach(() => {
        sinon.restore();
    });

    after(() => {
        if (originalNoteKey === undefined) {
            delete process.env.NOTE_ENCRYPTION_KEY;
            return;
        }

        process.env.NOTE_ENCRYPTION_KEY = originalNoteKey;
    });

    it('builds a block decision for high-risk trained alerts with a target', () => {
        const response = buildIncidentResponseDecision({
            _id: 'alert-1',
            source: 'realtime-ingest',
            severity: 'high',
            mlScore: 0.96,
            scoreSource: 'trained-logistic-regression',
            details: { ip: '203.0.113.9' },
            feedback: { label: 'important' }
        }, {
            config: {
                enabled: true,
                allowedSources: ['realtime-ingest'],
                notifyThreshold: 0.72,
                blockThreshold: 0.9,
                requireTrainedModelForBlock: true,
                notifyOnImportantFeedback: true,
                policyVersion: 'ml-autonomous-v1'
            },
            now: new Date('2026-03-21T15:00:00.000Z')
        });

        expect(response.level).to.equal('block');
        expect(response.target).to.equal('203.0.113.9');
        expect(response.trainedScoreUsed).to.equal(true);
        expect(response.actions).to.have.length(2);
        expect(response.actions.map((action) => action.type)).to.deep.equal(['notify', 'block']);
    });

    it('suppresses autonomous response when analyst feedback marks the alert as a false positive', () => {
        const response = buildIncidentResponseDecision({
            _id: 'alert-2',
            source: 'realtime-ingest',
            severity: 'high',
            mlScore: 0.98,
            scoreSource: 'trained-logistic-regression',
            details: { ip: '203.0.113.9' },
            feedback: { label: 'false_positive' }
        }, {
            config: {
                enabled: true,
                allowedSources: ['realtime-ingest'],
                notifyThreshold: 0.72,
                blockThreshold: 0.9,
                requireTrainedModelForBlock: true,
                notifyOnImportantFeedback: true,
                policyVersion: 'ml-autonomous-v1'
            }
        });

        expect(response.level).to.equal('none');
        expect(response.actions).to.deep.equal([]);
        expect(response.reason).to.include('suppresses autonomous response');
    });

    it('executes notifications and block actions and persists the response audit trail', async () => {
        const SecurityAlertModel = {
            find: sinon.stub(),
            bulkWrite: sinon.stub().resolves({ modifiedCount: 1 })
        };
        SecurityAlertModel.find
            .onFirstCall()
            .returns({
                lean: async () => ([{ _id: 'alert-3', response: { level: 'none', actions: [] } }])
            })
            .onSecondCall()
            .returns({
                lean: async () => ([{ _id: 'alert-3', response: { level: 'block', actions: [] } }])
            });
        const notifyAlertsSummaryFn = sinon.stub().resolves({
            slack: { ok: true, status: 200 },
            email: { skipped: true }
        });
        const sendBlockRequestsForAlertsFn = sinon.stub().resolves([
            {
                alertId: 'alert-3',
                target: '203.0.113.44',
                result: { ok: true, status: 202 }
            }
        ]);

        const result = await executeIncidentResponses([
            {
                _id: 'alert-3',
                source: 'realtime-ingest',
                severity: 'high',
                mlScore: 0.95,
                scoreSource: 'trained-logistic-regression',
                details: { ip: '203.0.113.44' },
                feedback: { label: 'important' }
            }
        ], {
            SecurityAlertModel,
            notifyAlertsSummaryFn,
            sendBlockRequestsForAlertsFn,
            config: {
                enabled: true,
                allowedSources: ['realtime-ingest'],
                notifyThreshold: 0.72,
                blockThreshold: 0.9,
                requireTrainedModelForBlock: true,
                notifyOnImportantFeedback: true,
                policyVersion: 'ml-autonomous-v1'
            },
            now: new Date('2026-03-21T15:30:00.000Z')
        });

        expect(notifyAlertsSummaryFn.calledOnce).to.equal(true);
        expect(sendBlockRequestsForAlertsFn.calledOnce).to.equal(true);
        expect(SecurityAlertModel.bulkWrite.calledOnce).to.equal(true);
        expect(result.persistedCount).to.equal(1);
        expect(result.alerts[0].response.level).to.equal('block');
        expect(result.alerts[0].response.actions.map((action) => action.status)).to.deep.equal(['sent', 'sent']);
    });
});
