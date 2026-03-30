const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/missionAssurancePageRoutes');

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

describe('Mission assurance page routes', () => {
    it('maps GET /mission-assurance to a handler', () => {
        expect(getHandler('get', '/mission-assurance')).to.exist;
    });

    it('maps GET /mission-assurance/module to a handler', () => {
        expect(getHandler('get', '/mission-assurance/module')).to.exist;
    });

    it('redirects GET /mission-assurance to the module page', async () => {
        const handler = getHandler('get', '/mission-assurance');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/mission-assurance/module')).to.equal(true);
    });

    it('renders the mission assurance module page', async () => {
        const handler = getHandler('get', '/mission-assurance/module', -1);
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/mission-assurance-module.ejs');
        expect(res.render.firstCall.args[1]).to.deep.equal({
            title: 'Mission Access Assurance Module',
            csrfToken: 'test-csrf-token'
        });
    });
});
