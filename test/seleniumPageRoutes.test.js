const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/seleniumPageRoutes');

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

describe('Selenium Page Routes', () => {
    it('maps GET /selenium to a handler', () => {
        expect(getHandler('get', '/selenium')).to.exist;
    });

    it('maps GET /selenium/module to a handler', () => {
        expect(getHandler('get', '/selenium/module')).to.exist;
    });

    it('redirects GET /selenium to /selenium/module', async () => {
        const handler = getHandler('get', '/selenium');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/selenium/module')).to.equal(true);
    });

    it('renders the Selenium module page for GET /selenium/module', async () => {
        const handler = getHandler('get', '/selenium/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/selenium-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Selenium Testing Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
