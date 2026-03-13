const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/securityPageRoutes');
const SecurityAlert = require('../src/models/SecurityAlert');

const getHandler = (method, path, stackIndex = 1) => {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
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
            alerts: fakeAlerts
        })).to.be.true;
    });
});
