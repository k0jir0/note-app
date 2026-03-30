const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/hardwareFirstMfaPageRoutes');

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

describe('Hardware-first MFA page routes', () => {
    it('maps GET /hardware-mfa to a handler', () => {
        expect(getHandler('get', '/hardware-mfa')).to.exist;
    });

    it('maps GET /hardware-mfa/module to a handler', () => {
        expect(getHandler('get', '/hardware-mfa/module')).to.exist;
    });

    it('redirects GET /hardware-mfa to the module page', async () => {
        const handler = getHandler('get', '/hardware-mfa');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/hardware-mfa/module')).to.equal(true);
    });

    it('renders the hardware-first MFA module page', async () => {
        const handler = getHandler('get', '/hardware-mfa/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/hardware-mfa-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Hardware-Backed MFA Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
