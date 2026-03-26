const { expect } = require('chai');

const {
    buildCurrentUserPersona,
    buildDecisionMatrix,
    evaluateMissionAccess,
    normalizeUserAccessProfile
} = require('../src/services/missionAccessControlService');

describe('Mission access control service', () => {
    it('normalizes a minimal user into a mission-aware access profile', () => {
        const profile = normalizeUserAccessProfile({
            email: 'tester@example.com'
        });

        expect(profile.missionRole).to.equal('analyst');
        expect(profile.clearance).to.equal('protected_b');
        expect(profile.assignedMissions).to.include('research-workspace');
        expect(profile.deviceTier).to.equal('managed');
        expect(profile.networkZones).to.deep.equal(['corp']);
        expect(profile.mfaVerified).to.equal(false);
    });

    it('allows a mission lead with hardened context to approve a block action', () => {
        const result = evaluateMissionAccess({
            subject: {
                displayName: 'Mission Lead',
                missionRole: 'mission_lead',
                clearance: 'secret',
                unit: 'cyber-task-force',
                assignedMissions: ['research-workspace', 'incident-response'],
                deviceTier: 'hardened',
                networkZones: ['mission'],
                mfaVerified: true,
                mfaMethod: 'hardware_token',
                mfaHardwareFirst: true
            },
            actionId: 'approve_block_action',
            resourceId: 'autonomy-block-policy',
            contextOverrides: {
                networkZone: 'mission'
            }
        });

        expect(result.allowed).to.equal(true);
        expect(result.failedChecks).to.have.length(0);
        expect(result.obligations).to.not.be.empty;
    });

    it('denies an analyst when the role and clearance are insufficient for model training', () => {
        const result = evaluateMissionAccess({
            subject: {
                displayName: 'Analyst',
                missionRole: 'analyst',
                clearance: 'protected_b',
                unit: 'cyber-task-force',
                assignedMissions: ['research-workspace'],
                deviceTier: 'managed',
                networkZones: ['corp'],
                mfaVerified: false
            },
            actionId: 'train_ml_model',
            resourceId: 'triage-model-training',
            contextOverrides: {
                networkZone: 'corp'
            }
        });

        expect(result.allowed).to.equal(false);
        expect(result.failedChecks.map((check) => check.id)).to.include('role');
        expect(result.failedChecks.map((check) => check.id)).to.include('clearance');
        expect(result.failedChecks.map((check) => check.id)).to.include('mfa');
    });

    it('builds a decision matrix for the current user persona', () => {
        const persona = buildCurrentUserPersona({
            email: 'tester@example.com',
            accessProfile: {
                missionRole: 'analyst',
                clearance: 'protected_b',
                assignedMissions: ['research-workspace'],
                deviceTier: 'managed',
                networkZones: ['corp']
            }
        });
        const matrix = buildDecisionMatrix(persona);

        expect(matrix.entries).to.have.length(5);
        expect(matrix.allowedCount).to.be.at.least(1);
        expect(matrix.deniedCount).to.be.at.least(1);
    });
});
