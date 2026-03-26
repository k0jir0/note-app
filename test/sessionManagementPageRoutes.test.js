const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/sessionManagementPageRoutes');

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

describe('Session management page routes', () => {
    it('maps GET /session-management to a handler', () => {
        expect(getHandler('get', '/session-management')).to.exist;
    });

    it('maps GET /session-management/module to a handler', () => {
        expect(getHandler('get', '/session-management/module')).to.exist;
    });

    it('redirects GET /session-management to the module page', async () => {
        const handler = getHandler('get', '/session-management');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/session-management/module')).to.equal(true);
    });

    it('renders the session management module page', async () => {
        const handler = getHandler('get', '/session-management/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/session-management-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Session Management Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
