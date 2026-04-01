const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/injectionPreventionPageRoutes');

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

describe('Injection prevention page routes', () => {
    it('maps GET /injection-prevention to a handler', () => {
        expect(getHandler('get', '/injection-prevention', 0)).to.exist;
    });

    it('maps GET /injection-prevention/module to a handler', () => {
        expect(getHandler('get', '/injection-prevention/module')).to.exist;
    });

    it('redirects GET /injection-prevention to the module page', async () => {
        const handler = getHandler('get', '/injection-prevention', 0);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/injection-prevention/module')).to.equal(true);
    });

    it('renders the injection-prevention module page', async () => {
        const handler = getHandler('get', '/injection-prevention/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/injection-prevention-module');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Query Injection Prevention Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
