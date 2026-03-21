const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/mlPageRoutes');

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

describe('ML Page Routes', () => {
    it('maps GET /ml to a handler', () => {
        expect(getHandler('get', '/ml')).to.exist;
    });

    it('maps GET /ml/module to a handler', () => {
        expect(getHandler('get', '/ml/module')).to.exist;
    });

    it('redirects GET /ml to /ml/module', async () => {
        const handler = getHandler('get', '/ml');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/ml/module')).to.equal(true);
    });

    it('renders the ML module page for GET /ml/module', async () => {
        const handler = getHandler('get', '/ml/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/ml-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'ML Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
