const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/accessControlPageRoutes');

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

describe('Access control page routes', () => {
    it('maps GET /access-control to a handler', () => {
        expect(getHandler('get', '/access-control', 0)).to.exist;
    });

    it('maps GET /access-control/module to a handler', () => {
        expect(getHandler('get', '/access-control/module')).to.exist;
    });

    it('redirects GET /access-control to the module page', async () => {
        const handler = getHandler('get', '/access-control', 1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() },
            isAuthenticated: () => true
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/access-control/module')).to.equal(true);
    });

    it('renders the access-control module page', async () => {
        const handler = getHandler('get', '/access-control/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() },
            isAuthenticated: () => true
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/access-control-module');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Server Access Control Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
