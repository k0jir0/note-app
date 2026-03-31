const { expect } = require('chai');

const {
    extractClientCertificateEvidence,
    normalizeDistinguishedName
} = require('../src/services/pkiRequestEvidenceService');

describe('PKI request evidence service', () => {
    it('normalizes distinguished-name objects into a stable string form', () => {
        const normalized = normalizeDistinguishedName({
            CN: 'tester@example.com',
            OU: 'CAF Research'
        });

        expect(normalized).to.equal('CN=tester@example.com, OU=CAF Research');
    });

    it('extracts trusted proxy certificate evidence in the test environment', () => {
        const headers = {
            'x-client-cert-proxy-verified': '1',
            'x-client-cert-verified': 'SUCCESS',
            'x-client-cert-subject': 'CN=tester@example.com, OU=CAF Research',
            'x-client-cert-issuer': 'CN=CAF Root CA',
            'x-client-cert-fingerprint': 'AA:BB:CC',
            'x-forwarded-for': '203.0.113.15',
            'x-forwarded-proto': 'https'
        };
        const req = {
            app: {
                locals: {
                    transportSecurity: {
                        trustedProxyAddresses: ['127.0.0.1']
                    }
                },
                get(setting) {
                    return setting === 'trust proxy';
                }
            },
            socket: {
                remoteAddress: '127.0.0.1'
            },
            get(headerName) {
                return headers[headerName.toLowerCase()] || '';
            }
        };

        const evidence = extractClientCertificateEvidence(req);

        expect(evidence).to.deep.equal({
            verified: true,
            source: 'trusted-proxy-header',
            subject: 'CN=tester@example.com, OU=CAF Research',
            issuer: 'CN=CAF Root CA',
            fingerprint256: 'AA:BB:CC'
        });
    });

    it('ignores proxy certificate headers when the request was not marked as trusted proxy traffic', () => {
        const headers = {
            'x-client-cert-verified': 'SUCCESS',
            'x-client-cert-subject': 'CN=tester@example.com, OU=CAF Research',
            'x-client-cert-issuer': 'CN=CAF Root CA',
            'x-forwarded-for': '203.0.113.15'
        };
        const req = {
            app: {
                locals: {
                    transportSecurity: {
                        trustedProxyAddresses: ['127.0.0.1']
                    }
                },
                get(setting) {
                    return setting === 'trust proxy';
                }
            },
            socket: {
                remoteAddress: '127.0.0.1'
            },
            get(headerName) {
                return headers[headerName.toLowerCase()] || '';
            }
        };

        expect(extractClientCertificateEvidence(req)).to.equal(null);
    });

    it('extracts an authorized peer certificate from a mutual-TLS request', () => {
        const req = {
            socket: {
                authorized: true,
                getPeerCertificate() {
                    return {
                        subject: {
                            CN: 'tester@example.com',
                            OU: 'CAF Research'
                        },
                        issuer: {
                            CN: 'CAF Root CA'
                        },
                        fingerprint256: 'AA:BB:CC:DD'
                    };
                }
            }
        };

        const evidence = extractClientCertificateEvidence(req);

        expect(evidence).to.deep.equal({
            verified: true,
            source: 'peer-certificate',
            subject: 'CN=tester@example.com, OU=CAF Research',
            issuer: 'CN=CAF Root CA',
            fingerprint256: 'AA:BB:CC:DD'
        });
    });

    it('ignores an unauthorized peer certificate even if a subject is present', () => {
        const req = {
            socket: {
                authorized: false,
                getPeerCertificate() {
                    return {
                        subject: {
                            CN: 'tester@example.com'
                        },
                        issuer: {
                            CN: 'Untrusted CA'
                        }
                    };
                }
            }
        };

        expect(extractClientCertificateEvidence(req)).to.equal(null);
    });
});
