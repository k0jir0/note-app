const { expect } = require('chai');
const mongoose = require('mongoose');

const { buildScanAlertCorrelations } = require('../src/utils/correlationAnalysis');
const { buildPersistedCorrelationDemo } = require('../src/utils/sampleCorrelationData');

describe('Correlation Analysis Utility', () => {
    it('correlates failed login bursts with authentication-exposed findings on the same target', () => {
        const scans = [{
            _id: new mongoose.Types.ObjectId(),
            target: '10.0.0.45',
            tool: 'nmap',
            summary: 'NMAP scan of 10.0.0.45',
            importedAt: new Date('2026-03-13T10:00:00Z'),
            findings: [{
                type: 'open_port',
                severity: 'high',
                title: 'Open port: TCP/3389 (ms-wbt-server)',
                details: { port: 3389, protocol: 'tcp', service: 'ms-wbt-server' }
            }]
        }];

        const alerts = [{
            _id: new mongoose.Types.ObjectId(),
            type: 'failed_login_burst',
            severity: 'high',
            summary: 'Repeated failed login attempts detected from 10.0.0.45',
            detectedAt: new Date('2026-03-13T10:10:00Z'),
            details: { ip: '10.0.0.45', count: 9 }
        }];

        const result = buildScanAlertCorrelations(scans, alerts, 10);

        expect(result.correlations).to.have.length(1);
        expect(result.correlations[0].severity).to.equal('high');
        expect(result.correlations[0].rationale.some((item) => item.includes('same target'))).to.equal(true);
        expect(result.correlations[0].rationale.some((item) => item.includes('authentication-exposed'))).to.equal(true);
    });

    it('correlates path probing with web-facing scan findings', () => {
        const scans = [{
            _id: new mongoose.Types.ObjectId(),
            target: 'target.local',
            tool: 'nikto',
            summary: 'NIKTO scan of target.local',
            importedAt: new Date('2026-03-13T08:00:00Z'),
            findings: [{
                type: 'misconfiguration',
                severity: 'medium',
                title: '/admin/: Admin directory found. Directory indexing may be enabled.',
                details: { raw: '/admin/: Admin directory found. Directory indexing may be enabled.' }
            }]
        }];

        const alerts = [{
            _id: new mongoose.Types.ObjectId(),
            type: 'suspicious_path_probe',
            severity: 'medium',
            summary: 'Suspicious path probing detected in server logs',
            detectedAt: new Date('2026-03-13T08:15:00Z'),
            details: {
                sample: ['2026-03-13 08:15:00 10.0.0.45 GET /admin 404'],
                sourceIps: { '10.0.0.45': 4 }
            }
        }];

        const result = buildScanAlertCorrelations(scans, alerts, 10);

        expect(result.correlations).to.have.length(1);
        expect(result.correlations[0].matchedIndicators.webFindingCount).to.equal(1);
    });

    it('returns no correlations when scans and alerts do not align', () => {
        const scans = [{
            _id: new mongoose.Types.ObjectId(),
            target: 'unknown',
            tool: 'json',
            summary: 'JSON scan import',
            importedAt: new Date('2026-03-13T07:00:00Z'),
            findings: [{
                type: 'info',
                severity: 'low',
                title: 'Informational banner',
                details: {}
            }]
        }];

        const alerts = [{
            _id: new mongoose.Types.ObjectId(),
            type: 'high_error_rate',
            severity: 'medium',
            summary: 'High 5xx server error rate detected',
            detectedAt: new Date('2026-03-13T07:10:00Z'),
            details: { errorCount: 15 }
        }];

        const result = buildScanAlertCorrelations(scans, alerts, 10);

        expect(result.correlations).to.have.length(0);
        expect(result.overview.total).to.equal(0);
    });

    it('builds a 3-target overview from the persisted correlation demo dataset', () => {
        const sampleData = buildPersistedCorrelationDemo();

        const result = buildScanAlertCorrelations(sampleData.scans, sampleData.alerts, 20);

        expect(result.overview.targets).to.equal(3);
        expect(result.correlations.length).to.be.greaterThan(2);
        expect(result.correlations.every((correlation) => sampleData.targets.includes(correlation.target))).to.equal(true);
        expect(result.correlations.every((correlation) => correlation.rationale.some((item) => item.includes('same target')) || correlation.rationale.some((item) => item.includes('scanner tool matches')))).to.equal(true);
    });

    it('does not correlate explicit IP alerts to mismatched IP scan targets just because the surfaces are similar', () => {
        const scans = [{
            _id: new mongoose.Types.ObjectId(),
            target: '10.10.10.60',
            tool: 'nmap',
            summary: 'NMAP scan of 10.10.10.60',
            importedAt: new Date('2026-03-13T10:00:00Z'),
            findings: [{
                type: 'open_port',
                severity: 'high',
                title: 'Open port: TCP/3389 (ms-wbt-server)',
                details: { port: 3389, protocol: 'tcp', service: 'ms-wbt-server' }
            }]
        }];

        const alerts = [{
            _id: new mongoose.Types.ObjectId(),
            type: 'failed_login_burst',
            severity: 'high',
            summary: 'Repeated failed login attempts detected from 10.10.10.70',
            detectedAt: new Date('2026-03-13T10:10:00Z'),
            details: { ip: '10.10.10.70', count: 9 }
        }];

        const result = buildScanAlertCorrelations(scans, alerts, 10);

        expect(result.correlations).to.have.length(0);
    });

    it('keeps overview totals based on all matches even when the returned list is limited', () => {
        const sampleData = buildPersistedCorrelationDemo(new Date('2026-03-13T12:00:00Z'));

        const result = buildScanAlertCorrelations(sampleData.scans, sampleData.alerts, 2);

        expect(result.correlations).to.have.length(2);
        // Now grouping is by distinct target so totals reflect unique target groups
        expect(result.totalCount).to.equal(3);
        expect(result.overview.total).to.equal(3);
        expect(result.overview.targets).to.equal(3);
    });
});
