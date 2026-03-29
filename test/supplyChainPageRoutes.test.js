const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/supplyChainPageRoutes');

function getHandler(method, path, stackIndex = 1) {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
}

function buildRes() {
    return {
        locals: { csrfToken: 'test-csrf-token' },
        render: sinon.stub(),
        redirect: sinon.stub(),
        status: sinon.stub().returnsThis(),
        send: sinon.stub().returnsThis()
    };
}

describe('Supply chain page routes', () => {
    it('maps GET /supply-chain to a handler', () => {
        expect(getHandler('get', '/supply-chain')).to.exist;
    });

    it('maps GET /supply-chain/module to a handler', () => {
        expect(getHandler('get', '/supply-chain/module')).to.exist;
    });

    it('redirects GET /supply-chain to the module page', async () => {
        const handler = getHandler('get', '/supply-chain');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/supply-chain/module')).to.equal(true);
    });

    it('renders the supply chain module page', async () => {
        const handler = getHandler('get', '/supply-chain/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/supply-chain-module.ejs');
        expect(res.render.firstCall.args[1].title).to.equal('Supply Chain Module');
        expect(res.render.firstCall.args[1].csrfToken).to.equal('test-csrf-token');
        expect(res.render.firstCall.args[1].moduleData.summary.totalComponents).to.be.a('number');
        expect(res.render.firstCall.args[1].moduleData.auditScripts).to.be.an('array').that.is.not.empty;
        expect(res.render.firstCall.args[1].moduleData.containerChecks).to.be.an('array').that.is.not.empty;
    });
});
