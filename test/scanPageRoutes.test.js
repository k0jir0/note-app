const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/scanPageRoutes');
const getHandler = (method, path, stackIndex = 1) => {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );
    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    locals: { csrfToken: 'test-csrf-token' },
    render: sinon.stub(),
    redirect: sinon.stub(),
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis()
});

describe('Scan Page Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps GET /security/scans to a handler', () => {
        const handler = getHandler('get', '/security/scans');

        expect(handler).to.exist;
    });

    it('redirects the legacy scans page to the security module scans section', async () => {
        const handler = getHandler('get', '/security/scans');
        const userId = new mongoose.Types.ObjectId();

        const req = { user: { _id: userId } };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/security/module#scans')).to.be.true;
    });
});
