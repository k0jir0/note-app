const { expect } = require('chai');

const {
    buildSelfRegisteredAccessProfile,
    upgradeLegacySelfRegisteredAccessProfile
} = require('../src/services/identityProvisioningService');

describe('identity provisioning service', () => {
    it('grants research workspace access to self-registered users in open runtimes', () => {
        const profile = buildSelfRegisteredAccessProfile({
            identityLifecycle: {
                protectedRuntime: false,
                selfSignupEnabled: true,
                googleAutoProvisionEnabled: true
            }
        });

        expect(profile).to.deep.include({
            missionRole: 'analyst',
            clearance: 'protected_b',
            unit: 'cyber-task-force',
            deviceTier: 'managed'
        });
        expect(profile.assignedMissions).to.deep.equal(['research-workspace', 'browser-assurance']);
        expect(profile.networkZones).to.deep.equal(['corp']);
    });

    it('keeps legacy external provisioning in protected runtimes', () => {
        const profile = buildSelfRegisteredAccessProfile({
            identityLifecycle: {
                protectedRuntime: true,
                selfSignupEnabled: false,
                googleAutoProvisionEnabled: false
            }
        });

        expect(profile).to.deep.include({
            missionRole: 'external',
            clearance: 'unclassified',
            unit: 'external-collaboration',
            deviceTier: 'unknown'
        });
        expect(profile.assignedMissions).to.deep.equal([]);
        expect(profile.networkZones).to.deep.equal(['public']);
    });

    it('upgrades legacy self-registered users to the open-runtime research profile', () => {
        const user = {
            accessProfile: {
                missionRole: 'external',
                clearance: 'unclassified',
                unit: 'external-collaboration',
                assignedMissions: [],
                deviceTier: 'unknown',
                networkZones: ['public'],
                registeredHardwareToken: false,
                hardwareTokenLabel: '',
                hardwareTokenSerial: '',
                webauthnCredentials: [],
                registeredPkiCertificate: false,
                pkiCertificateSubject: '',
                pkiCertificateIssuer: '',
                breakGlassApproved: false,
                breakGlassReason: ''
            },
            markModified(field) {
                this.modifiedField = field;
            }
        };

        const upgraded = upgradeLegacySelfRegisteredAccessProfile(user, {
            identityLifecycle: {
                protectedRuntime: false,
                selfSignupEnabled: true,
                googleAutoProvisionEnabled: true
            }
        });

        expect(upgraded).to.equal(true);
        expect(user.modifiedField).to.equal('accessProfile');
        expect(user.accessProfile.missionRole).to.equal('analyst');
        expect(user.accessProfile.clearance).to.equal('protected_b');
        expect(user.accessProfile.assignedMissions).to.deep.equal(['research-workspace', 'browser-assurance']);
        expect(user.accessProfile.networkZones).to.deep.equal(['corp']);
    });

    it('does not mutate accounts that are already intentionally scoped', () => {
        const user = {
            accessProfile: {
                missionRole: 'operator',
                clearance: 'protected_b',
                unit: 'cyber-task-force',
                assignedMissions: ['research-workspace'],
                deviceTier: 'managed',
                networkZones: ['corp']
            }
        };

        const upgraded = upgradeLegacySelfRegisteredAccessProfile(user, {
            identityLifecycle: {
                protectedRuntime: false,
                selfSignupEnabled: true,
                googleAutoProvisionEnabled: true
            }
        });

        expect(upgraded).to.equal(false);
        expect(user.accessProfile.missionRole).to.equal('operator');
    });
});
