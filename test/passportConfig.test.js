const { expect } = require('chai');
const sinon = require('sinon');
const bcrypt = require('bcrypt');

const User = require('../src/models/User');
const passportConfig = require('../src/config/passport');
const { encryptText } = require('../src/utils/noteEncryption');

describe('Passport configuration', () => {
    const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
    const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const originalNoteKey = process.env.NOTE_ENCRYPTION_KEY;

    before(() => {
        process.env.NOTE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
    });

    after(() => {
        if (originalGoogleClientId === undefined) {
            delete process.env.GOOGLE_CLIENT_ID;
        } else {
            process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
        }

        if (originalGoogleClientSecret === undefined) {
            delete process.env.GOOGLE_CLIENT_SECRET;
        } else {
            process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
        }

        if (originalNoteKey === undefined) {
            delete process.env.NOTE_ENCRYPTION_KEY;
        } else {
            process.env.NOTE_ENCRYPTION_KEY = originalNoteKey;
        }
    });

    afterEach(() => {
        sinon.restore();
    });

    function createFakePassport() {
        return {
            use(strategy) {
                if (strategy && strategy.name === 'local') {
                    this.localStrategy = strategy;
                    return;
                }

                this.googleStrategy = strategy;
            },
            serializeUser(handler) {
                this.serializeHandler = handler;
            },
            deserializeUser(handler) {
                this.deserializeHandler = handler;
            }
        };
    }

    it('decrypts the user name during deserializeUser before views use req.user', (done) => {
        const fakePassport = createFakePassport();

        passportConfig(fakePassport);

        sinon.stub(User, 'findById').resolves({
            _id: '507f191e810c19729de860ea',
            email: 'analyst@example.com',
            name: encryptText('Analyst User'),
            accessProfile: {}
        });

        fakePassport.deserializeHandler('507f191e810c19729de860ea', (error, user) => {
            expect(error).to.equal(null);
            expect(user.name).to.equal('Analyst User');
            done();
        });
    });

    it('blocks local authentication when the account is already locked', (done) => {
        const fakePassport = createFakePassport();

        passportConfig(fakePassport);

        sinon.stub(User, 'findOne').resolves({
            email: 'analyst@example.com',
            authenticationState: {
                lockoutUntil: new Date(Date.now() + 60 * 1000)
            }
        });
        const compareStub = sinon.stub(bcrypt, 'compare');

        fakePassport.localStrategy._verify(
            { ip: '203.0.113.25' },
            'analyst@example.com',
            'password123',
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('ACCOUNT_LOCKED');
                expect(compareStub.called).to.equal(false);
                done();
            }
        );
    });

    it('blocks Google authentication when the linked account is already locked', (done) => {
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        const fakePassport = createFakePassport();
        passportConfig(fakePassport);

        sinon.stub(User, 'findOne').resolves({
            email: 'analyst@example.com',
            googleId: 'google-subject-1',
            authenticationState: {
                lockoutUntil: new Date(Date.now() + 60 * 1000)
            }
        });

        fakePassport.googleStrategy._verify(
            'https://accounts.google.com',
            {
                id: 'google-subject-1',
                emails: [{ value: 'analyst@example.com' }]
            },
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('ACCOUNT_LOCKED');
                done();
            }
        );
    });

    it('blocks Google account linking when the matching local account is locked', (done) => {
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        const fakePassport = createFakePassport();
        passportConfig(fakePassport);

        sinon.stub(User, 'findOne')
            .onFirstCall()
            .resolves(null)
            .onSecondCall()
            .resolves({
                email: 'analyst@example.com',
                authenticationState: {
                    lockoutUntil: new Date(Date.now() + 60 * 1000)
                }
            });

        fakePassport.googleStrategy._verify(
            'https://accounts.google.com',
            {
                id: 'google-subject-2',
                emails: [{ value: 'analyst@example.com' }]
            },
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('ACCOUNT_LOCKED');
                done();
            }
        );
    });

    it('blocks Google authentication when the linked account is disabled', (done) => {
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        const fakePassport = createFakePassport();
        passportConfig(fakePassport);

        sinon.stub(User, 'findOne').resolves({
            email: 'disabled@example.com',
            googleId: 'google-subject-disabled',
            accountState: {
                status: 'disabled'
            }
        });

        fakePassport.googleStrategy._verify(
            'https://accounts.google.com',
            {
                id: 'google-subject-disabled',
                emails: [{ value: 'disabled@example.com' }]
            },
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('ACCOUNT_DISABLED');
                done();
            }
        );
    });

    it('blocks local authentication when the account is disabled', (done) => {
        const fakePassport = createFakePassport();

        passportConfig(fakePassport);

        sinon.stub(User, 'findOne').resolves({
            email: 'disabled@example.com',
            accountState: {
                status: 'disabled'
            }
        });
        const compareStub = sinon.stub(bcrypt, 'compare');

        fakePassport.localStrategy._verify(
            { ip: '203.0.113.25' },
            'disabled@example.com',
            'password123',
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('ACCOUNT_DISABLED');
                expect(compareStub.called).to.equal(false);
                done();
            }
        );
    });

    it('creates externally scoped Google users when auto-provisioning is allowed', (done) => {
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        const fakePassport = createFakePassport();
        passportConfig(fakePassport, {
            identityLifecycle: {
                protectedRuntime: false,
                selfSignupEnabled: true,
                googleAutoProvisionEnabled: true
            }
        });

        sinon.stub(User, 'findOne')
            .onFirstCall()
            .resolves(null)
            .onSecondCall()
            .resolves(null);
        sinon.stub(User.prototype, 'save').callsFake(function () {
            return Promise.resolve(this);
        });

        fakePassport.googleStrategy._verify(
            'https://accounts.google.com',
            {
                id: 'google-subject-3',
                displayName: 'External User',
                emails: [{ value: 'external@example.com' }]
            },
            (error, user) => {
                expect(error).to.equal(null);
                expect(user.email).to.equal('external@example.com');
                expect(user.accessProfile.missionRole).to.equal('external');
                expect(user.accessProfile.clearance).to.equal('unclassified');
                expect(user.accessProfile.networkZones).to.deep.equal(['public']);
                done();
            }
        );
    });

    it('blocks Google auto-provisioning in protected runtimes', (done) => {
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

        const fakePassport = createFakePassport();
        passportConfig(fakePassport, {
            identityLifecycle: {
                protectedRuntime: true,
                selfSignupEnabled: false,
                googleAutoProvisionEnabled: false
            }
        });

        sinon.stub(User, 'findOne')
            .onFirstCall()
            .resolves(null)
            .onSecondCall()
            .resolves(null);

        fakePassport.googleStrategy._verify(
            'https://accounts.google.com',
            {
                id: 'google-subject-4',
                displayName: 'Protected User',
                emails: [{ value: 'protected@example.com' }]
            },
            (error, user, info) => {
                expect(error).to.equal(null);
                expect(user).to.equal(false);
                expect(info.code).to.equal('IDENTITY_NOT_PROVISIONED');
                done();
            }
        );
    });
});
