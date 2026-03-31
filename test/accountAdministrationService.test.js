const { expect } = require('chai');
const sinon = require('sinon');

const User = require('../src/models/User');
const accountAdministrationService = require('../src/services/accountAdministrationService');

describe('account administration service', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('lists managed accounts as summarized admin-facing records', async () => {
        sinon.stub(User, 'find').returns({
            sort: sinon.stub().resolves([
                {
                    _id: '507f1f77bcf86cd799439011',
                    email: 'admin@example.com',
                    name: 'Admin User',
                    googleId: 'google-sub-1',
                    password: 'hashed-password',
                    accessProfile: {
                        missionRole: 'admin',
                        clearance: 'protected_b',
                        unit: 'ops',
                        assignedMissions: ['browser-assurance'],
                        deviceTier: 'managed',
                        networkZones: ['corp']
                    },
                    accountState: {
                        status: 'active'
                    }
                }
            ])
        });

        const accounts = await accountAdministrationService.listManagedAccounts();

        expect(accounts).to.have.length(1);
        expect(accounts[0]).to.include({
            id: '507f1f77bcf86cd799439011',
            email: 'admin@example.com',
            name: 'Admin User',
            googleLinked: true,
            localPasswordEnabled: true
        });
        expect(accounts[0].accessProfile).to.deep.equal({
            missionRole: 'admin',
            clearance: 'protected_b',
            unit: 'ops',
            assignedMissions: ['browser-assurance'],
            deviceTier: 'managed',
            networkZones: ['corp']
        });
    });

    it('creates a new managed account with least-privilege internal defaults', async () => {
        sinon.stub(User, 'findOne').resolves(null);
        sinon.stub(User.prototype, 'save').callsFake(function () {
            return Promise.resolve(this);
        });

        const result = await accountAdministrationService.provisionManagedAccount({
            email: 'operator@example.com',
            actor: 'admin@example.com'
        });

        expect(result.created).to.equal(true);
        expect(result.account.email).to.equal('operator@example.com');
        expect(result.account.localPasswordEnabled).to.equal(false);
        expect(result.account.googleLinked).to.equal(false);
        expect(result.account.accessProfile).to.deep.equal({
            missionRole: 'operator',
            clearance: 'protected_b',
            unit: 'cyber-task-force',
            assignedMissions: [],
            deviceTier: 'managed',
            networkZones: ['corp']
        });
        expect(result.account.accountState.status).to.equal('active');
    });

    it('re-activates and updates an existing managed account when provisioning by email', async () => {
        const save = sinon.stub().resolves();
        const existingUser = {
            _id: '507f1f77bcf86cd799439011',
            email: 'operator@example.com',
            password: '',
            name: '',
            accessProfile: {
                missionRole: 'external',
                clearance: 'unclassified',
                unit: 'legacy-unit',
                assignedMissions: [],
                deviceTier: 'unknown',
                networkZones: ['public']
            },
            accountState: {
                status: 'disabled',
                disabledReason: 'Legacy hold',
                disabledBy: 'older-admin@example.com'
            },
            save
        };
        sinon.stub(User, 'findOne').resolves(existingUser);
        sinon.stub(require('bcrypt'), 'hash').resolves('hashed-password');

        const result = await accountAdministrationService.provisionManagedAccount({
            email: 'operator@example.com',
            name: 'Operator User',
            password: 'OperatorPass123!',
            accessProfile: {
                missionRole: 'operator',
                clearance: 'protected_b',
                unit: 'ops',
                assignedMissions: ['browser-assurance'],
                deviceTier: 'managed',
                networkZones: ['corp']
            },
            actor: 'admin@example.com'
        });

        expect(result.created).to.equal(false);
        expect(existingUser.name).to.equal('Operator User');
        expect(existingUser.password).to.equal('hashed-password');
        expect(existingUser.accountState.status).to.equal('active');
        expect(existingUser.accessProfile.missionRole).to.equal('operator');
        expect(existingUser.accessProfile.networkZones).to.deep.equal(['corp']);
        expect(save.calledOnce).to.equal(true);
    });

    it('disables an account and clears session binding metadata', async () => {
        const save = sinon.stub().resolves();
        const user = {
            _id: '507f1f77bcf86cd799439011',
            email: 'operator@example.com',
            accessProfile: {
                missionRole: 'operator',
                clearance: 'protected_b',
                unit: 'ops',
                assignedMissions: [],
                deviceTier: 'managed',
                networkZones: ['corp']
            },
            sessionControl: {
                activeSessionId: 'session-1',
                activeSessionIssuedAt: new Date('2026-03-31T10:00:00.000Z'),
                lastLockReason: '',
                lastLockAt: null
            },
            accountState: {
                status: 'active'
            },
            save
        };
        sinon.stub(User, 'findById').resolves(user);

        const result = await accountAdministrationService.updateManagedAccountState({
            userId: '507f1f77bcf86cd799439011',
            status: 'disabled',
            reason: 'Incident response hold',
            actor: 'admin@example.com'
        });

        expect(result.accountState.status).to.equal('disabled');
        expect(user.sessionControl.activeSessionId).to.equal('');
        expect(user.sessionControl.activeSessionIssuedAt).to.equal(null);
        expect(user.sessionControl.lastLockReason).to.equal('account_disabled');
        expect(save.calledOnce).to.equal(true);
    });
});
