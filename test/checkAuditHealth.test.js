const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    assertAuditHealth,
    buildAuditHealthReport,
    fetchAuditHealth,
    resolveHealthUrl,
    writeAuditHealthReport
} = require('../scripts/check-audit-health');

describe('ITSG-33 audit health checks', () => {
    it('builds a passing report for a healthy audit sink', () => {
        const report = buildAuditHealthReport({
            healthUrl: 'https://helios.example/healthz',
            statusCode: 200,
            checkedAt: new Date('2026-04-02T12:00:00.000Z'),
            body: {
                ok: true,
                breakGlass: {
                    mode: 'disabled',
                    enabled: false
                },
                immutableLogging: {
                    enabled: true,
                    healthy: true,
                    degraded: false,
                    requireRemoteSuccess: true
                }
            }
        });

        expect(report).to.deep.equal({
            checkedAt: '2026-04-02T12:00:00.000Z',
            healthUrl: 'https://helios.example/healthz',
            statusCode: 200,
            ok: true,
            detailsRestricted: false,
            breakGlass: {
                mode: 'disabled',
                enabled: false
            },
            immutableLogging: {
                enabled: true,
                healthy: true,
                degraded: false,
                requireRemoteSuccess: true
            },
            checks: {
                httpOk: true,
                appOk: true,
                auditEnabled: true,
                auditHealthy: true,
                auditNotDegraded: true
            }
        });

        expect(assertAuditHealth(report)).to.deep.equal([]);
    });

    it('flags disabled immutable logging unless explicitly allowed', () => {
        const report = buildAuditHealthReport({
            healthUrl: 'http://localhost:3000/healthz',
            statusCode: 200,
            body: {
                ok: true,
                immutableLogging: {
                    enabled: false,
                    healthy: true,
                    degraded: false,
                    requireRemoteSuccess: false
                }
            }
        });

        expect(assertAuditHealth(report)).to.deep.equal([
            'Immutable logging is not enabled.'
        ]);
        expect(assertAuditHealth(report, { allowDisabled: true })).to.deep.equal([]);
    });

    it('flags restricted diagnostics when the health endpoint hides audit details', () => {
        const report = buildAuditHealthReport({
            healthUrl: 'https://helios.example/healthz',
            statusCode: 200,
            body: {
                ok: true,
                detailsRestricted: true
            }
        });

        expect(report.detailsRestricted).to.equal(true);
        expect(assertAuditHealth(report)).to.deep.equal([
            'Health endpoint returned restricted diagnostics. Re-run with --bearer-token, ITSG33_HEALTHCHECK_TOKEN, or METRICS_AUTH_TOKEN.'
        ]);
    });

    it('resolves the health URL from APP_BASE_URL when no explicit URL is provided', () => {
        const healthUrl = resolveHealthUrl({
            env: {
                APP_BASE_URL: 'https://helios.example/'
            }
        });

        expect(healthUrl).to.equal('https://helios.example/healthz');
    });

    it('fetches the health endpoint and forwards an optional bearer token', async () => {
        let observedRequest = null;

        const report = await fetchAuditHealth({
            healthUrl: 'https://helios.example/healthz',
            bearerToken: 'sample-token',
            fetchImpl: async (url, options) => {
                observedRequest = { url, options };
                return {
                    status: 200,
                    text: async () => JSON.stringify({
                        ok: true,
                        breakGlass: {
                            mode: 'disabled',
                            enabled: false
                        },
                        immutableLogging: {
                            enabled: true,
                            healthy: true,
                            degraded: false,
                            requireRemoteSuccess: true
                        }
                    })
                };
            }
        });

        expect(observedRequest).to.not.equal(null);
        expect(observedRequest.url).to.equal('https://helios.example/healthz');
        expect(observedRequest.options.headers).to.deep.equal({
            Authorization: 'Bearer sample-token'
        });
        expect(report.checks.httpOk).to.equal(true);
    });

    it('writes the collected report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-audit-health-'));
        const outputFile = path.join(tempDirectory, 'reports', 'audit-health.json');
        const report = buildAuditHealthReport({
            healthUrl: 'http://localhost:3000/healthz',
            statusCode: 200,
            body: {
                ok: true,
                immutableLogging: {
                    enabled: true,
                    healthy: true,
                    degraded: false,
                    requireRemoteSuccess: true
                }
            }
        });

        const writtenPath = writeAuditHealthReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));

        expect(writtenPath).to.equal(path.resolve(outputFile));
        expect(persisted.immutableLogging.enabled).to.equal(true);
    });
});
