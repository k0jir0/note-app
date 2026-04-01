const { expect } = require('chai');
const sinon = require('sinon');

const SecurityAlert = require('../src/models/SecurityAlert');
const {
    buildAutonomyDemoAlerts,
    injectAutonomyDemo
} = require('../src/services/autonomyDemoService');

describe('Autonomy demo service', () => {
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

    it('builds one block candidate and one notify candidate from the configured source', () => {
        const alerts = buildAutonomyDemoAlerts('user-demo', {
            now: new Date('2026-03-21T13:00:00.000Z'),
            config: {
                allowedSources: ['realtime-ingest']
            }
        });

        expect(alerts).to.have.length(2);
        expect(alerts.map((alert) => alert.source)).to.deep.equal(['realtime-ingest', 'realtime-ingest']);

        const blockCandidate = alerts.find((alert) => alert.type === 'injection_attempt');
        const notifyCandidate = alerts.find((alert) => alert.type === 'suspicious_path_probe');

        expect(blockCandidate.severity).to.equal('high');
        expect(blockCandidate.mlScore).to.equal(0.97);
        expect(blockCandidate.details.ip).to.equal('203.0.113.250');

        expect(notifyCandidate.severity).to.equal('medium');
        expect(notifyCandidate.mlScore).to.equal(0.82);
        expect(notifyCandidate.details.ip).to.equal('198.51.100.44');
    });

    it('injects dry-run alerts and records notify/block response summaries', async () => {
        const insertedAlerts = buildAutonomyDemoAlerts('user-demo', {
            now: new Date('2026-03-21T13:30:00.000Z'),
            config: {
                allowedSources: ['realtime-ingest']
            }
        }).map((alert, index) => ({
            _id: `demo-alert-${index + 1}`,
            ...alert
        }));

        const SecurityAlertModel = {
            bulkWrite: sinon.stub().resolves({ modifiedCount: 2 })
        };

        sinon.stub(SecurityAlert, 'insertMany').resolves(insertedAlerts);

        const result = await injectAutonomyDemo('user-demo', {
            now: new Date('2026-03-21T13:30:00.000Z'),
            config: {
                enabled: true,
                allowedSources: ['realtime-ingest'],
                notifyThreshold: 0.72,
                blockThreshold: 0.9,
                requireTrainedModelForBlock: true,
                notifyOnImportantFeedback: true,
                policyVersion: 'ml-autonomous-v1'
            },
            SecurityAlertModel
        });

        expect(SecurityAlert.insertMany.calledOnce).to.equal(true);
        expect(SecurityAlertModel.bulkWrite.calledOnce).to.equal(true);
        expect(result.mode).to.equal('dry-run');
        expect(result.createdAlerts).to.equal(2);
        expect(result.levelCounts.notify).to.equal(1);
        expect(result.levelCounts.block).to.equal(1);

        const blockAlert = result.alerts.find((alert) => alert.response.level === 'block');
        const notifyAlert = result.alerts.find((alert) => alert.response.level === 'notify');

        expect(blockAlert.response.actions.map((action) => action.status)).to.deep.equal(['skipped', 'skipped']);
        expect(notifyAlert.response.actions.map((action) => action.status)).to.deep.equal(['skipped']);
    });
});
