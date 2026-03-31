const { expect } = require('chai');
const sinon = require('sinon');

const settingsApiController = require('../src/controllers/settingsApiController');
const userPreferencesService = require('../src/services/userPreferencesService');
const accountAdministrationService = require('../src/services/accountAdministrationService');

function createRes() {
    return {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return body;
        }
    };
}

describe('settings API controller', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('updates the theme preference for the authenticated user', async () => {
        sinon.stub(userPreferencesService, 'updateNightModePreference').resolves({
            success: true,
            nightMode: true
        });
        const req = {
            body: { nightMode: true },
            user: {
                _id: '507f1f77bcf86cd799439011',
                preferences: {
                    nightMode: false
                }
            }
        };
        const res = createRes();

        await settingsApiController.updateThemePreference(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.deep.equal({
            success: true,
            nightMode: true
        });
        expect(req.user.preferences.nightMode).to.equal(true);
    });

    it('returns the managed accounts list for privileged callers', async () => {
        sinon.stub(accountAdministrationService, 'listManagedAccounts').resolves([
            { id: '507f1f77bcf86cd799439011', email: 'admin@example.com' }
        ]);
        const res = createRes();

        await settingsApiController.listManagedAccounts({}, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.deep.equal({
            success: true,
            accounts: [{ id: '507f1f77bcf86cd799439011', email: 'admin@example.com' }]
        });
    });

    it('rejects invalid provisioning email payloads', async () => {
        const req = {
            body: {
                email: 'not-an-email'
            },
            user: {
                email: 'admin@example.com'
            }
        };
        const res = createRes();

        await settingsApiController.provisionManagedAccount(req, res);

        expect(res.statusCode).to.equal(400);
        expect(res.payload.message).to.equal('Please enter a valid email address (e.g., user@example.com)');
    });

    it('provisions a managed account and returns 201 when a new account is created', async () => {
        sinon.stub(accountAdministrationService, 'provisionManagedAccount').resolves({
            created: true,
            account: {
                id: '507f1f77bcf86cd799439011',
                email: 'operator@example.com'
            }
        });
        const req = {
            body: {
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
                }
            },
            user: {
                email: 'admin@example.com'
            }
        };
        const res = createRes();

        await settingsApiController.provisionManagedAccount(req, res);

        expect(res.statusCode).to.equal(201);
        expect(res.payload).to.deep.equal({
            success: true,
            created: true,
            account: {
                id: '507f1f77bcf86cd799439011',
                email: 'operator@example.com'
            }
        });
    });

    it('requires a reason when disabling an account', async () => {
        const req = {
            params: {
                userId: '507f1f77bcf86cd799439011'
            },
            body: {
                status: 'disabled'
            },
            user: {
                email: 'admin@example.com'
            }
        };
        const res = createRes();

        await settingsApiController.updateManagedAccountState(req, res);

        expect(res.statusCode).to.equal(400);
        expect(res.payload.message).to.equal('reason is required when disabling an account');
    });

    it('updates account state for a valid privileged request', async () => {
        sinon.stub(accountAdministrationService, 'updateManagedAccountState').resolves({
            id: '507f1f77bcf86cd799439011',
            email: 'operator@example.com',
            accountState: {
                status: 'disabled'
            }
        });
        const req = {
            params: {
                userId: '507f1f77bcf86cd799439011'
            },
            body: {
                status: 'disabled',
                reason: 'Incident response hold'
            },
            user: {
                email: 'admin@example.com'
            }
        };
        const res = createRes();

        await settingsApiController.updateManagedAccountState(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.deep.equal({
            success: true,
            account: {
                id: '507f1f77bcf86cd799439011',
                email: 'operator@example.com',
                accountState: {
                    status: 'disabled'
                }
            }
        });
    });
});
