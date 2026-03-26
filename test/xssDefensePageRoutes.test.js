const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/xssDefensePageRoutes');

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

describe('XSS defense page routes', () => {
    it('maps GET /xss-defense to a handler', () => {
        expect(getHandler('get', '/xss-defense', 0)).to.exist;
    });

    it('maps GET /xss-defense/module to a handler', () => {
        expect(getHandler('get', '/xss-defense/module')).to.exist;
    });

    it('redirects GET /xss-defense to the module page', async () => {
        const handler = getHandler('get', '/xss-defense', 0);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/xss-defense/module')).to.equal(true);
    });

    it('renders the xss-defense module page', async () => {
        const handler = getHandler('get', '/xss-defense/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/xss-defense-module');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'XSS Defense Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
