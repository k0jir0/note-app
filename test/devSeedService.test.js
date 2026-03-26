const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');

const {
    buildSeedResponseMessage,
    listDevSeedAccounts,
    resolveDevelopmentSeedPassword,
    seedDevelopmentData
} = require('../src/services/devSeedService');

describe('Development seed service', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('lists the seeded development accounts with role coverage', () => {
        const accounts = listDevSeedAccounts();
        const roles = accounts.map((account) => account.missionRole);

        expect(accounts).to.have.length(6);
        expect(accounts[0].email).to.equal('test@example.com');
        expect(roles).to.deep.equal([
            'analyst',
            'operator',
            'mission_lead',
            'auditor',
            'admin',
            'break_glass'
        ]);
    });

    it('seeds the development account matrix and sample analyst notes', async () => {
        const deleteUsersStub = sinon.stub().resolves();
        const deleteNotesStub = sinon.stub().resolves();
        const createdUsers = [];
        const createdNotes = [];
        const User = {
            deleteMany: deleteUsersStub,
            create: sinon.stub().callsFake(async (payload) => {
                const user = {
                    _id: `user-${createdUsers.length + 1}`,
                    ...payload
                };

                createdUsers.push(user);
                return user;
            })
        };
        const Notes = {
            deleteMany: deleteNotesStub,
            create: sinon.stub().callsFake(async (payload) => {
                createdNotes.push(...payload);
                return payload;
            })
        };
        const bcryptLib = {
            hash: sinon.stub().resolves('hashedPassword123')
        };

        const summary = await seedDevelopmentData({
            User,
            Notes,
            bcryptLib,
            password: 'DevSeedPass123!'
        });

        expect(deleteNotesStub.calledOnceWithExactly({})).to.equal(true);
        expect(deleteUsersStub.calledOnceWithExactly({})).to.equal(true);
        expect(bcryptLib.hash.calledOnceWithExactly('DevSeedPass123!', 10)).to.equal(true);
        expect(User.create.callCount).to.equal(6);
        expect(createdUsers[0].email).to.equal('test@example.com');
        expect(createdUsers[0].accessProfile.missionRole).to.equal('analyst');
        expect(createdUsers[4].accessProfile.missionRole).to.equal('admin');
        expect(createdUsers[4].accessProfile.clearance).to.equal('top_secret');
        expect(createdUsers[5].accessProfile.breakGlassApproved).to.equal(true);
        expect(Notes.create.calledOnce).to.equal(true);
        expect(createdNotes).to.have.length(3);
        expect(createdNotes.every((note) => note.user === 'user-1')).to.equal(true);
        expect(summary.notesSeededFor).to.equal('test@example.com');
        expect(summary.accounts).to.have.length(6);
    });

    it('uses DEV_SEED_PASSWORD when one is configured locally', () => {
        const originalValue = process.env.DEV_SEED_PASSWORD;

        try {
            process.env.DEV_SEED_PASSWORD = 'LocalSeedPass123!';

            expect(resolveDevelopmentSeedPassword()).to.equal('LocalSeedPass123!');
        } finally {
            if (originalValue === undefined) {
                delete process.env.DEV_SEED_PASSWORD;
            } else {
                process.env.DEV_SEED_PASSWORD = originalValue;
            }
        }
    });

    it('generates a fresh password when no seed password is configured', () => {
        const originalValue = process.env.DEV_SEED_PASSWORD;
        const randomStub = sinon.stub(crypto, 'randomBytes').returns(Buffer.from('seedtoken', 'utf8'));

        try {
            delete process.env.DEV_SEED_PASSWORD;

            expect(resolveDevelopmentSeedPassword()).to.equal('seed-c2VlZHRva2Vu');
            expect(randomStub.calledOnceWithExactly(9)).to.equal(true);
        } finally {
            if (originalValue === undefined) {
                delete process.env.DEV_SEED_PASSWORD;
            } else {
                process.env.DEV_SEED_PASSWORD = originalValue;
            }
        }
    });

    it('builds a readable seed response message', () => {
        const message = buildSeedResponseMessage({
            password: 'LocalSeedPass123!',
            notesSeededFor: 'test@example.com',
            accounts: [
                {
                    label: 'Analyst User',
                    email: 'test@example.com',
                    missionRole: 'analyst',
                    clearance: 'protected_b'
                },
                {
                    label: 'Policy Admin',
                    email: 'admin@example.com',
                    missionRole: 'admin',
                    clearance: 'top_secret'
                }
            ]
        });

        expect(message).to.include('Database seeded with development accounts.');
        expect(message).to.include('test@example.com / LocalSeedPass123!');
        expect(message).to.include('admin@example.com / LocalSeedPass123!');
        expect(message).to.include('Sample notes created for: test@example.com');
    });
});
