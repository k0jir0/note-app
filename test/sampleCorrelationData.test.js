const { expect } = require('chai');

const { buildPersistedCorrelationDemo, buildSampleCorrelationInputs } = require('../src/utils/sampleCorrelationData');

describe('Sample Correlation Data', () => {
    it('builds a sample scan and correlated alerts for demo injection', () => {
        const sampleData = buildSampleCorrelationInputs();

        expect(sampleData.scans).to.have.length(1);
        expect(sampleData.scans[0].tool).to.equal('nikto');
        expect(sampleData.alerts.length).to.be.greaterThan(0);
        expect(sampleData.sampleLogText).to.include('Nikto/2.1.6');
    });

    it('builds a persisted correlation demo with 3 distinct targets and varied alert patterns', () => {
        const sampleData = buildPersistedCorrelationDemo(new Date('2026-03-13T12:00:00Z'));

        expect(sampleData.scans).to.have.length(3);
        expect(sampleData.targets).to.deep.equal(['10.10.10.50', '10.10.10.60', '10.10.10.70']);
        expect(sampleData.alerts.some((alert) => alert.type === 'failed_login_burst')).to.equal(true);
        expect(sampleData.alerts.some((alert) => alert.type === 'suspicious_path_probe')).to.equal(true);
        expect(sampleData.alerts.some((alert) => alert.type === 'injection_attempt')).to.equal(true);
        expect(sampleData.scans[0].importedAt.toISOString()).to.equal('2026-03-13T11:55:00.000Z');
        expect(sampleData.alerts[4].detectedAt.toISOString()).to.equal('2026-03-13T12:02:00.000Z');
    });
});
