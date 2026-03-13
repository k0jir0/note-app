const { expect } = require('chai');

const { buildSampleCorrelationInputs } = require('../src/utils/sampleCorrelationData');

describe('Sample Correlation Data', () => {
    it('builds a sample scan and correlated alerts for demo injection', () => {
        const sampleData = buildSampleCorrelationInputs();

        expect(sampleData.scans).to.have.length(1);
        expect(sampleData.scans[0].tool).to.equal('nikto');
        expect(sampleData.alerts.length).to.be.greaterThan(0);
        expect(sampleData.sampleLogText).to.include('Nikto/2.1.6');
    });
});
