const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/securityPageRoutes');
const getHandler = (method, path, stackIndex = 1) => {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    locals: { csrfToken: 'test-csrf-token' },
    render: sinon.stub(),
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis()
});

describe('Security Page Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps GET /security/logs to a handler', () => {
        const handler = getHandler('get', '/security/logs');

        expect(handler).to.exist;
    });

    it('renders the security logs page with recent alerts', async () => {
        const handler = getHandler('get', '/security/logs');
        const userId = new mongoose.Types.ObjectId();
        const fakeAlerts = [{ summary: 'Suspicious path probing detected' }];

        const SecurityAlert = require('../src/models/SecurityAlert');

        sinon.stub(SecurityAlert, 'find').returns({
            sort: sinon.stub().returnsThis(),
            limit: sinon.stub().resolves(fakeAlerts)
        });

        const req = {
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledWith('pages/security-logs.ejs', {
            title: 'Log Analysis Assistant',
            alerts: fakeAlerts,
            csrfToken: 'test-csrf-token'
        })).to.be.true;
    });

    it('maps GET /security/correlations to a handler', () => {
        const handler = getHandler('get', '/security/correlations');

        expect(handler).to.exist;
    });

    it('renders the correlation dashboard empty on initial load', async () => {
        const handler = getHandler('get', '/security/correlations');
        const userId = new mongoose.Types.ObjectId();

        const req = { user: { _id: userId } };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/security-correlations.ejs');
        expect(res.render.firstCall.args[1].correlations).to.deep.equal([]);
        expect(res.render.firstCall.args[1].overview.total).to.equal(0);
        expect(res.render.firstCall.args[1].csrfToken).to.equal('test-csrf-token');
    });
});
