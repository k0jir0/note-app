const { expect } = require('chai');

const {
    buildTrainingExampleFromAlert,
    generateSyntheticTrainingExamples
} = require('../src/utils/alertTriageTrainingData');

describe('Alert triage training data', () => {
    it('builds weighted training examples from labeled alerts', () => {
        const example = buildTrainingExampleFromAlert({
            type: 'failed_login_burst',
            severity: 'medium',
            summary: 'Repeated failed login attempts detected',
            details: {
                count: 7,
                threshold: 5,
                sourceIps: { '203.0.113.10': 7 }
            },
            feedback: {
                label: 'important',
                updatedAt: new Date('2026-03-21T12:00:00.000Z')
            }
        });

        expect(example.label).to.equal(1);
        expect(example.weight).to.equal(1.2);
        expect(example.features.type).to.equal('failed_login_burst');
        expect(example.source).to.equal('analyst-feedback');
    });

    it('generates synthetic bootstrap examples with both classes represented', () => {
        const examples = generateSyntheticTrainingExamples({
            count: 120,
            seed: 20260321
        });
        const labels = new Set(examples.map((example) => example.label));

        expect(examples).to.have.length(120);
        expect(labels.has(0)).to.equal(true);
        expect(labels.has(1)).to.equal(true);
        expect(examples.every((example) => example.source === 'synthetic-bootstrap')).to.equal(true);
    });
});
