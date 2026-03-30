const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/playwrightPageRoutes');

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

describe('Playwright Page Routes', () => {
    it('maps GET /playwright to a handler', () => {
        expect(getHandler('get', '/playwright')).to.exist;
    });

    it('maps GET /playwright/module to a handler', () => {
        expect(getHandler('get', '/playwright/module')).to.exist;
    });

    it('redirects GET /playwright to /playwright/module', async () => {
        const handler = getHandler('get', '/playwright');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/playwright/module')).to.equal(true);
    });

    it('renders the Playwright module page for GET /playwright/module', async () => {
        const handler = getHandler('get', '/playwright/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/playwright-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Playwright Testing Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
