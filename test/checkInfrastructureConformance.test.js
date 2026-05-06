const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    DEFAULT_MIN_CERT_VALID_DAYS,
    assertInfrastructureConformance,
    deriveHttpProbeUrl,
    parseArgs,
    probeHttpRedirect,
    resolveInfrastructureConformanceOptions,
    runInfrastructureConformanceCheck,
    writeInfrastructureConformanceReport
} = require('../scripts/check-infrastructure-conformance');

describe('Infrastructure conformance checks', () => {
    it('parses optional CLI arguments', () => {
        const options = parseArgs([
            '--public-base-url=https://helios.example',
            '--health-url=https://helios.example/healthz',
            '--output=artifacts/itsg33/quarterly-review/infrastructure-conformance.json'
        ]);

        expect(options).to.deep.equal({
            publicBaseUrl: 'https://helios.example',
            pageUrl: '',
            healthUrl: 'https://helios.example/healthz',
            bearerToken: '',
            outputFile: 'artifacts/itsg33/quarterly-review/infrastructure-conformance.json',
            timeoutMs: 5000,
            minCertValidDays: 14
        });
    });

    it('derives an HTTP redirect probe URL from a public HTTPS origin', () => {
        expect(deriveHttpProbeUrl('https://helios.example/security/module')).to.equal(
            'http://helios.example/security/module'
        );
    });

    it('resolves infrastructure options from the environment', () => {
        const options = resolveInfrastructureConformanceOptions({}, {
            APP_BASE_URL: 'https://helios.example',
            ITSG33_HEALTHCHECK_TOKEN: 'health-token'
        });

        expect(options.publicBaseUrl).to.equal('https://helios.example');
        expect(options.pageUrl).to.equal('https://helios.example');
        expect(options.healthUrl).to.equal('https://helios.example/healthz');
        expect(options.bearerToken).to.equal('health-token');
    });

    it('checks whether HTTP redirects to HTTPS', async () => {
        const probe = await probeHttpRedirect('http://helios.example', {
            expectedLocation: 'https://helios.example',
            fetchImpl: async () => ({
                status: 301,
                headers: {
                    get(name) {
                        return name === 'location' ? 'https://helios.example' : '';
                    }
                }
            })
        });

        expect(probe.success).to.equal(true);
        expect(probe.location).to.equal('https://helios.example');
    });

    it('runs a successful infrastructure check with mocked probes', async () => {
        const issuedAt = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toUTCString();
        const expiresAt = new Date(Date.now() + ((DEFAULT_MIN_CERT_VALID_DAYS + 7) * 24 * 60 * 60 * 1000)).toUTCString();
        const report = await runInfrastructureConformanceCheck({
            publicBaseUrl: 'https://helios.example',
            healthUrl: 'https://helios.example/healthz'
        }, {
            fetchImpl: async (url, options = {}) => {
                if (options.redirect === 'manual') {
                    return {
                        status: 301,
                        headers: {
                            get(name) {
                                return name === 'location' ? 'https://helios.example' : '';
                            }
                        }
                    };
                }

                return {
                    status: 200,
                    headers: {
                        get(name) {
                            if (name === 'strict-transport-security') {
                                return 'max-age=31536000';
                            }
                            if (name === 'content-security-policy') {
                                return 'default-src \'self\'';
                            }
                            return '';
                        }
                    },
                    text: async () => JSON.stringify({
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
                        }
                    })
                };
            },
            connectTlsImpl: (_options, callback) => {
                const listeners = {};
                const socket = {
                    once(event, handler) {
                        listeners[event] = handler;
                    },
                    getPeerCertificate() {
                        return {
                            valid_from: issuedAt,
                            valid_to: expiresAt
                        };
                    },
                    getProtocol() {
                        return 'TLSv1.3';
                    },
                    end() {}
                };
                setTimeout(callback, 0);
                return socket;
            }
        });

        expect(assertInfrastructureConformance(report)).to.deep.equal([]);
        expect(report.httpRedirect.success).to.equal(true);
        expect(report.pageHeaders.checks.cspPresent).to.equal(true);
        expect(report.tlsCertificate.protocol).to.equal('TLSv1.3');
    });

    it('flags missing headers and non-HTTPS public origins', () => {
        const failures = assertInfrastructureConformance({
            publicBaseUrl: 'http://helios.example',
            httpRedirect: {
                executed: true,
                success: false,
                reason: 'Redirect missing.'
            },
            pageHeaders: {
                executed: true,
                checks: {
                    hstsPresent: false,
                    cspPresent: false
                }
            },
            tlsCertificate: {
                executed: true,
                success: false,
                reason: 'TLS probe failed.'
            },
            auditHealth: {
                statusCode: 200,
                detailsRestricted: true,
                checks: {
                    httpOk: true,
                    appOk: true
                }
            }
        });

        expect(failures).to.deep.equal([
            'Public base URL is not configured with https://.',
            'Redirect missing.',
            'TLS probe failed.',
            'Strict-Transport-Security header is missing.',
            'Content-Security-Policy header is missing.',
            'Health endpoint returned restricted diagnostics.'
        ]);
    });

    it('writes the collected report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-infra-conformance-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'infrastructure-conformance.json');
        const report = {
            publicBaseUrl: 'https://helios.example'
        };

        const writtenPath = writeInfrastructureConformanceReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));

        expect(writtenPath).to.equal(path.resolve(outputFile));
        expect(persisted.publicBaseUrl).to.equal('https://helios.example');
    });
});
