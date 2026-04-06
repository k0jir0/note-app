const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    assertSecretRotationReport,
    buildSecretRotationReport,
    normalizeSecretRotationSpec,
    parseArgs,
    parseRotationSpecs,
    resolveRotationSpecs,
    writeSecretRotationReport
} = require('../scripts/check-secret-rotation-age');

describe('Secret rotation age checks', () => {
    it('parses optional CLI arguments', () => {
        const options = parseArgs([
            '--output=artifacts/itsg33/monthly-review/secret-rotation.json',
            '--specs-json=[]',
            '--default-max-age-days=30'
        ]);

        expect(options).to.deep.equal({
            outputFile: 'artifacts/itsg33/monthly-review/secret-rotation.json',
            specsJson: '[]',
            specsFile: '',
            defaultMaxAgeDays: 30
        });
    });

    it('normalizes a rotation spec and flags stale secrets', () => {
        const spec = normalizeSecretRotationSpec({
            id: 'google_oidc',
            label: 'Google OIDC client secret',
            rotatedAt: '2026-01-01T00:00:00.000Z',
            maxAgeDays: 60
        }, {
            referenceTime: new Date('2026-04-06T00:00:00.000Z')
        });

        expect(spec).to.include({
            id: 'google_oidc',
            label: 'Google OIDC client secret',
            maxAgeDays: 60,
            status: 'stale'
        });
        expect(spec.reason).to.include('exceeds');
    });

    it('builds a summary report across ok, warn, stale, and invalid entries', () => {
        const report = buildSecretRotationReport({
            checkedAt: new Date('2026-04-06T00:00:00.000Z'),
            defaultMaxAgeDays: 30,
            specs: [
                {
                    id: 'session_secret',
                    rotatedAt: '2026-03-20T00:00:00.000Z'
                },
                {
                    id: 'health_probe_token',
                    rotatedAt: '2026-03-10T00:00:00.000Z'
                },
                {
                    id: 'backup_key',
                    rotatedAt: '2026-01-01T00:00:00.000Z'
                },
                {
                    label: 'Missing identifier',
                    rotatedAt: '2026-03-25T00:00:00.000Z'
                }
            ]
        });

        expect(report.skipped).to.equal(false);
        expect(report.summary).to.deep.equal({
            totalSecrets: 4,
            ok: 1,
            warn: 1,
            stale: 1,
            invalid: 1
        });
        expect(assertSecretRotationReport(report)).to.deep.equal([
            'backup_key: Rotation age 95d exceeds the 30d policy.',
            'Missing identifier: Secret rotation spec is missing id, name, or label.'
        ]);
    });

    it('returns a skipped report when no specs are configured', () => {
        const report = buildSecretRotationReport();

        expect(report.skipped).to.equal(true);
        expect(assertSecretRotationReport(report)).to.deep.equal([]);
    });

    it('parses rotation specs from JSON and from the environment', () => {
        expect(parseRotationSpecs('[{\"id\":\"session_secret\"}]')).to.deep.equal([
            {
                id: 'session_secret'
            }
        ]);

        expect(resolveRotationSpecs({}, {
            ITSG33_SECRET_ROTATION_SPECS: '[{\"id\":\"session_secret\"}]'
        })).to.deep.equal([
            {
                id: 'session_secret'
            }
        ]);
    });

    it('writes the report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-secret-rotation-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'secret-rotation.json');
        const report = buildSecretRotationReport({
            checkedAt: new Date('2026-04-06T00:00:00.000Z'),
            defaultMaxAgeDays: 30,
            specs: [{
                id: 'session_secret',
                rotatedAt: '2026-03-20T00:00:00.000Z'
            }]
        });

        const writtenPath = writeSecretRotationReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));

        expect(writtenPath).to.equal(path.resolve(outputFile));
        expect(persisted.summary.totalSecrets).to.equal(1);
    });
});
