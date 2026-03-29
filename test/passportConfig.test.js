const { expect } = require('chai');
const sinon = require('sinon');

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

    it('decrypts the user name during deserializeUser before views use req.user', (done) => {
        const fakePassport = {
            use() {},
            serializeUser(handler) {
                this.serializeHandler = handler;
            },
            deserializeUser(handler) {
                this.deserializeHandler = handler;
            }
        };

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
});
