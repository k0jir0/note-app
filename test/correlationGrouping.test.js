const { expect } = require('chai');
const { buildScanAlertCorrelations } = require('../src/utils/correlationAnalysis');

describe('Correlation grouping', () => {
    it('groups pairwise matches by target and reports totalCount/overview.total', () => {
        const scans = [
            { _id: 's1', target: '10.0.0.1', tool: 'nmap' },
            { _id: 's2', target: '10.0.0.1', tool: 'nmap' },
            { _id: 's3', target: '10.0.0.2', tool: 'nmap' }
        ];

        const alerts = [
            { _id: 'a1', target: '10.0.0.1', details: { ip: '10.0.0.1' }, type: 'scanner_tool_detected', severity: 'low' },
            { _id: 'a2', target: '10.0.0.1', details: { ip: '10.0.0.1' }, type: 'scanner_tool_detected', severity: 'low' },
            { _id: 'a3', target: '10.0.0.2', details: { ip: '10.0.0.2' }, type: 'scanner_tool_detected', severity: 'low' }
        ];

        const result = buildScanAlertCorrelations(scans, alerts);

        expect(result).to.be.an('object');
        // totalCount should equal number of distinct targets with matches (2)
        expect(result).to.have.property('totalCount');
        expect(result.totalCount).to.equal(2);

        expect(result).to.have.property('overview');
        expect(result.overview).to.have.property('total', 2);
        expect(result.overview).to.have.property('targets').that.is.a('number');

        expect(result).to.have.property('correlations').that.is.an('array').with.lengthOf(2);
        const targets = result.correlations.map((c) => c.target).sort();
        expect(targets).to.eql(['10.0.0.1', '10.0.0.2']);
    });

    it('handles empty inputs without throwing', () => {
        const empty = buildScanAlertCorrelations([], []);
        expect(empty).to.be.an('object');
        expect(empty.totalCount).to.equal(0);
        expect(empty.overview).to.have.property('total', 0);
        expect(empty.correlations).to.be.an('array').that.is.empty;
    });
});
