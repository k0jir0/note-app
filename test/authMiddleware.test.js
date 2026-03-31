const sinon = require('sinon');
const { expect } = require('chai');

const { requireAuth, requireAuthAPI } = require('../src/middleware/auth');

describe('auth middleware fail-secure behavior', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('redirects to login when page auth evaluation throws', () => {
        const req = {
            isAuthenticated() {
                throw new Error('session store offline');
            },
            user: { _id: 'user-1' }
        };
        const res = {
            redirect: sinon.stub()
        };
        const next = sinon.stub();

        requireAuth(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.redirect.calledWith('/auth/login')).to.equal(true);
    });

    it('returns unauthorized when api auth evaluation throws', () => {
        const req = {
            isAuthenticated() {
                throw new Error('session store offline');
            },
            user: { _id: 'user-1' }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };
        const next = sinon.stub();

        requireAuthAPI(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(401)).to.equal(true);
        expect(res.json.calledWith({
            success: false,
            message: 'Unauthorized',
            errors: ['Authentication could not be completed. Please try again.']
        })).to.equal(true);
    });
});