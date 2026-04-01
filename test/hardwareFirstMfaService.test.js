const { expect } = require('chai');

const {
    buildCurrentHardwareMfaSession,
    issueHardwareFirstMfaChallenge,
    normalizeRegisteredAuthenticators,
    revokeHardwareFirstMfaSession,
    verifyHardwareFirstMfaChallenge
} = require('../src/services/hardwareFirstMfaService');

describe('Hardware-first MFA service', () => {
    it('normalizes registered hardware tokens and PKI certificates from the access profile', () => {
        const authenticators = normalizeRegisteredAuthenticators({
            accessProfile: {
                registeredHardwareToken: true,
                hardwareTokenLabel: 'YubiKey 5',
                hardwareTokenSerial: 'CAF-1234',
                registeredPkiCertificate: true,
                pkiCertificateSubject: 'CN=tester@example.com, OU=CAF Research',
                pkiCertificateIssuer: 'CN=CAF Root CA'
            }
        });

        expect(authenticators).to.have.length(2);
        expect(authenticators[0].method).to.equal('hardware_token');
        expect(authenticators[1].method).to.equal('pki_certificate');
    });

    it('issues and verifies a hardware-token challenge', async () => {
        const session = {};
        const user = {
            accessProfile: {
                registeredHardwareToken: true,
                hardwareTokenLabel: 'YubiKey 5'
            }
        };

        const challenge = issueHardwareFirstMfaChallenge({
            user,
            session,
            method: 'hardware_token'
        });
        const assurance = await verifyHardwareFirstMfaChallenge({
            user,
            session,
            method: 'hardware_token',
            challengeId: challenge.challengeId,
            responseValue: 'touch'
        });

        expect(challenge.challengeId).to.match(/^mfa-/);
        expect(assurance.verified).to.equal(true);
        expect(assurance.hardwareFirst).to.equal(true);
        expect(assurance.method).to.equal('hardware_token');
    });

    it('rejects a PKI verification response when the certificate subject does not match', async () => {
        const session = {};
        const user = {
            accessProfile: {
                registeredPkiCertificate: true,
                pkiCertificateSubject: 'CN=tester@example.com, OU=CAF Research',
                pkiCertificateIssuer: 'CN=CAF Root CA'
            }
        };

        const challenge = issueHardwareFirstMfaChallenge({
            user,
            session,
            method: 'pki_certificate'
        });

        try {
            await verifyHardwareFirstMfaChallenge({
                user,
                session,
                method: 'pki_certificate',
                challengeId: challenge.challengeId,
                requestEvidence: {
                    verified: true,
                    subject: 'CN=someone-else@example.com, OU=CAF Research',
                    issuer: 'CN=CAF Root CA'
                }
            });
            throw new Error('Expected PKI verification to fail');
        } catch (error) {
            expect(error.code).to.equal('INVALID_CERTIFICATE_ASSERTION');
        }
    });

    it('revokes the active hardware-first session assurance', async () => {
        const session = {};
        const user = {
            accessProfile: {
                registeredHardwareToken: true,
                hardwareTokenLabel: 'MissionLeadKey'
            }
        };

        const challenge = issueHardwareFirstMfaChallenge({
            user,
            session,
            method: 'hardware_token'
        });

        await verifyHardwareFirstMfaChallenge({
            user,
            session,
            method: 'hardware_token',
            challengeId: challenge.challengeId,
            responseValue: 'MissionLeadKey'
        });

        const revoked = revokeHardwareFirstMfaSession({ session });

        expect(buildCurrentHardwareMfaSession(session).verified).to.equal(false);
        expect(revoked.verified).to.equal(false);
    });
});
