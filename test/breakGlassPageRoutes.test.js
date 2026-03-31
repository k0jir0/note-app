const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/breakGlassPageRoutes');

function getHandler(method, path, stackIndex = 1) {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );

    if (!layer) {
        return null;
    }

    const resolvedIndex = stackIndex < 0 ? layer.route.stack.length + stackIndex : stackIndex;
    return layer.route.stack[resolvedIndex].handle;
}

function buildRes() {
    return {
        locals: { csrfToken: 'test-csrf-token' },
        render: sinon.stub(),
        redirect: sinon.stub()
    };
}

describe('Break-glass page routes', () => {
    it('maps GET /break-glass to a handler', () => {
        expect(getHandler('get', '/break-glass', 1)).to.exist;
    });

    it('maps GET /break-glass/module to a handler', () => {
        expect(getHandler('get', '/break-glass/module')).to.exist;
    });

    it('redirects GET /break-glass to the module page', async () => {
        const handler = getHandler('get', '/break-glass', 1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() },
            isAuthenticated: () => true
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/break-glass/module')).to.equal(true);
    });

    it('renders the break-glass module page', async () => {
        const handler = getHandler('get', '/break-glass/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() },
            isAuthenticated: () => true
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/break-glass-module');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Break-Glass and Emergency Control Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
