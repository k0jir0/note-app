const { expect } = require('chai');
const sinon = require('sinon');

const SecurityAlert = require('../src/models/SecurityAlert');

const {
    buildScanSummary,
    createContentFingerprint,
    persistAutomatedAlerts
} = require('../src/services/automationService');

describe('Automation Service', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('builds a useful scan summary from parsed findings', () => {
        const summary = buildScanSummary({
            tool: 'nmap',
            target: 'example.internal',
            findings: [
                { severity: 'high' },
                { severity: 'medium' },
                { severity: 'low' }
            ]
        });

        expect(summary).to.equal('NMAP scan of example.internal: 3 finding(s), 1 high, 1 medium');
    });

    it('creates stable content fingerprints', () => {
        const left = createContentFingerprint('same input');
        const right = createContentFingerprint('same input');
        const other = createContentFingerprint('different input');

        expect(left).to.equal(right);
        expect(left).to.not.equal(other);
    });

    it('does not dedupe alerts when the dedupe window is zero', async () => {
        const findStub = sinon.stub(SecurityAlert, 'find');
        const insertManyStub = sinon.stub(SecurityAlert, 'insertMany').resolves();

        const result = await persistAutomatedAlerts({
            userId: '507f1f77bcf86cd799439011',
            source: 'automation-sample',
            dedupeWindowMs: 0
        }, [
            '2026-03-13 09:14:10 203.0.113.25 POST /auth/login 401',
            '2026-03-13 09:14:11 203.0.113.25 POST /auth/login 401',
            '2026-03-13 09:14:12 203.0.113.25 POST /auth/login 403',
            '2026-03-13 09:14:13 203.0.113.25 POST /auth/login 401',
            '2026-03-13 09:14:14 203.0.113.25 POST /auth/login 401'
        ].join('\n'));

        expect(findStub.called).to.equal(false);
        expect(insertManyStub.calledOnce).to.equal(true);
        expect(result.createdAlerts).to.equal(1);
        expect(result.skippedAlerts).to.equal(0);
    });
});
