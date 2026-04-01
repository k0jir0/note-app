const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/locatorRepairPageRoutes');

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
        redirect: sinon.stub()
    };
}

describe('Locator repair Page Routes', () => {
    it('maps GET /self-healing to a handler', () => {
        expect(getHandler('get', '/self-healing')).to.exist;
    });

    it('maps GET /self-healing/module to a handler', () => {
        expect(getHandler('get', '/self-healing/module')).to.exist;
    });

    it('keeps GET /locator-repair as a legacy redirect to /self-healing/module', async () => {
        const handler = getHandler('get', '/locator-repair');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/self-healing/module')).to.equal(true);
    });

    it('keeps GET /locator-repair/module as a legacy redirect to /self-healing/module', async () => {
        const handler = getHandler('get', '/locator-repair/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/self-healing/module')).to.equal(true);
    });

    it('renders the self-healing module page for GET /self-healing/module', async () => {
        const handler = getHandler('get', '/self-healing/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/locator-repair-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Self-Healing Locator Repair Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
