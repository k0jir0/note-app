const { expect } = require('chai');

const {
    encryptUserDocument,
    decryptUserDocument,
    encryptUserUpdatePayload,
    encryptSecurityAlertDocument,
    decryptSecurityAlertDocument,
    encryptSecurityAlertBulkWriteOperations,
    encryptScanResultDocument,
    decryptScanResultDocument
} = require('../src/utils/sensitiveModelEncryption');
const { isEncryptedValue } = require('../src/utils/noteEncryption');

describe('Sensitive Model Encryption', () => {
    const originalNoteKey = process.env.NOTE_ENCRYPTION_KEY;

    before(() => {
        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    after(() => {
        if (originalNoteKey === undefined) {
            delete process.env.NOTE_ENCRYPTION_KEY;
            return;
        }

        process.env.NOTE_ENCRYPTION_KEY = originalNoteKey;
    });

    it('encrypts and decrypts sensitive user profile fields while preserving auth lookup fields', () => {
        const user = {
            email: 'analyst@example.com',
            googleId: 'google-user-id',
            name: 'Analyst One',
            accessProfile: {
                missionRole: 'mission_lead',
                clearance: 'secret',
                deviceTier: 'hardened',
                assignedMissions: ['northern-watch'],
                webauthnCredentials: [{
                    credentialId: 'credential-123',
                    publicKey: 'public-key-material',
                    transports: ['usb'],
                    label: 'Main security key'
                }],
                breakGlassReason: 'Approved for emergency incident response'
            },
            sessionControl: {
                activeSessionId: 'session-123',
                lastLockReason: 'Operator locked terminal'
            }
        };

        encryptUserDocument(user);

        expect(user.email).to.equal('analyst@example.com');
        expect(user.googleId).to.equal('google-user-id');
        expect(isEncryptedValue(user.name)).to.equal(true);
        expect(user.accessProfile.missionRole).to.equal('mission_lead');
        expect(user.accessProfile.clearance).to.equal('secret');
        expect(user.accessProfile.deviceTier).to.equal('hardened');
        expect(isEncryptedValue(user.accessProfile.assignedMissions[0])).to.equal(true);
        expect(isEncryptedValue(user.accessProfile.webauthnCredentials[0].credentialId)).to.equal(true);
        expect(isEncryptedValue(user.sessionControl.activeSessionId)).to.equal(true);

        decryptUserDocument(user);

        expect(user.name).to.equal('Analyst One');
        expect(user.accessProfile.missionRole).to.equal('mission_lead');
        expect(user.accessProfile.clearance).to.equal('secret');
        expect(user.accessProfile.deviceTier).to.equal('hardened');
        expect(user.accessProfile.assignedMissions[0]).to.equal('northern-watch');
        expect(user.accessProfile.webauthnCredentials[0].credentialId).to.equal('credential-123');
        expect(user.accessProfile.webauthnCredentials[0].publicKey).to.equal('public-key-material');
        expect(user.sessionControl.activeSessionId).to.equal('session-123');
    });

    it('encrypts sensitive user updates in both direct and $set payloads', () => {
        const update = encryptUserUpdatePayload({
            name: 'Updated operator',
            $set: {
                accessProfile: {
                    missionRole: 'operator',
                    networkZones: ['dmz']
                }
            }
        });

        expect(isEncryptedValue(update.name)).to.equal(true);
        expect(update.$set.accessProfile.missionRole).to.equal('operator');
        expect(isEncryptedValue(update.$set.accessProfile.networkZones[0])).to.equal(true);
    });

    it('decrypts legacy encrypted enum-backed access profile fields for compatibility', () => {
        const legacyUser = {
            accessProfile: {
                missionRole: 'mission_lead',
                clearance: 'secret',
                deviceTier: 'managed'
            }
        };

        legacyUser.accessProfile.missionRole = require('../src/utils/noteEncryption').encryptText(legacyUser.accessProfile.missionRole);
        legacyUser.accessProfile.clearance = require('../src/utils/noteEncryption').encryptText(legacyUser.accessProfile.clearance);
        legacyUser.accessProfile.deviceTier = require('../src/utils/noteEncryption').encryptText(legacyUser.accessProfile.deviceTier);

        decryptUserDocument(legacyUser);

        expect(legacyUser.accessProfile.missionRole).to.equal('mission_lead');
        expect(legacyUser.accessProfile.clearance).to.equal('secret');
        expect(legacyUser.accessProfile.deviceTier).to.equal('managed');
    });

    it('encrypts alert payloads but preserves indexed fingerprints for dedupe lookups', () => {
        const alert = {
            summary: 'Repeated failed logins against staging VPN',
            details: {
                ip: '10.2.3.4',
                username: 'operator@example.com',
                _fingerprint: 'stable-fingerprint'
            },
            mlReasons: ['Multiple failures from one source'],
            mlFeatures: {
                sourceRegion: 'ca-central'
            },
            response: {
                reason: 'Escalate to SOC analyst',
                target: 'vpn-gateway-01',
                actions: [{
                    provider: 'slack',
                    detail: 'Posted analyst notification',
                    target: '#soc-ops'
                }]
            }
        };

        encryptSecurityAlertDocument(alert);

        expect(isEncryptedValue(alert.summary)).to.equal(true);
        expect(isEncryptedValue(alert.details.ip)).to.equal(true);
        expect(alert.details._fingerprint).to.equal('stable-fingerprint');
        expect(isEncryptedValue(alert.response.reason)).to.equal(true);
        expect(isEncryptedValue(alert.response.actions[0].detail)).to.equal(true);

        decryptSecurityAlertDocument(alert);

        expect(alert.summary).to.equal('Repeated failed logins against staging VPN');
        expect(alert.details.ip).to.equal('10.2.3.4');
        expect(alert.details.username).to.equal('operator@example.com');
        expect(alert.details._fingerprint).to.equal('stable-fingerprint');
        expect(alert.response.reason).to.equal('Escalate to SOC analyst');
        expect(alert.response.actions[0].detail).to.equal('Posted analyst notification');
    });

    it('encrypts security alert bulkWrite updates before persistence', () => {
        const operations = [{
            updateOne: {
                filter: { _id: '507f191e810c19729de860ea' },
                update: {
                    $set: {
                        summary: 'Autonomous response issued',
                        details: {
                            targetIp: '192.168.1.5',
                            _fingerprint: 'fingerprint-1'
                        },
                        response: {
                            reason: 'High-confidence malicious pattern',
                            target: 'edge-firewall',
                            actions: [{
                                provider: 'webhook',
                                detail: 'Sent quarantine request',
                                target: 'https://example.invalid/hooks/block'
                            }]
                        }
                    }
                }
            }
        }];

        encryptSecurityAlertBulkWriteOperations(operations);

        const updatedAlert = operations[0].updateOne.update.$set;
        expect(isEncryptedValue(updatedAlert.summary)).to.equal(true);
        expect(isEncryptedValue(updatedAlert.details.targetIp)).to.equal(true);
        expect(updatedAlert.details._fingerprint).to.equal('fingerprint-1');
        expect(isEncryptedValue(updatedAlert.response.reason)).to.equal(true);
        expect(isEncryptedValue(updatedAlert.response.actions[0].target)).to.equal(true);
    });

    it('encrypts and decrypts scan targets and finding details at rest', () => {
        const scan = {
            target: '172.16.0.8',
            summary: 'Nikto identified outdated admin panel components',
            findings: [{
                title: 'Open administrative interface',
                details: {
                    path: '/admin',
                    evidence: 'Server banner leaked version metadata'
                }
            }]
        };

        encryptScanResultDocument(scan);

        expect(isEncryptedValue(scan.target)).to.equal(true);
        expect(isEncryptedValue(scan.summary)).to.equal(true);
        expect(isEncryptedValue(scan.findings[0].title)).to.equal(true);
        expect(isEncryptedValue(scan.findings[0].details.path)).to.equal(true);

        decryptScanResultDocument(scan);

        expect(scan.target).to.equal('172.16.0.8');
        expect(scan.summary).to.equal('Nikto identified outdated admin panel components');
        expect(scan.findings[0].title).to.equal('Open administrative interface');
        expect(scan.findings[0].details.path).to.equal('/admin');
    });
});
