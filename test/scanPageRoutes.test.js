const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/scanPageRoutes');
const ScanResult = require('../src/models/ScanResult');

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

describe('Scan Page Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps GET /security/scans to a handler', () => {
        const handler = getHandler('get', '/security/scans');

        expect(handler).to.exist;
    });

    it('renders the scan dashboard with recent scans', async () => {
        const handler = getHandler('get', '/security/scans');
        const userId = new mongoose.Types.ObjectId();
        const fakeScans = [{ target: '10.0.0.1', tool: 'nikto', findings: [] }];

        sinon.stub(ScanResult, 'find').returns({
            sort: sinon.stub().returnsThis(),
            limit: sinon.stub().resolves(fakeScans)
        });

        const req = { user: { _id: userId } };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/security-scans.ejs');
        expect(res.render.firstCall.args[1].scans).to.deep.equal(fakeScans);
    });
});
