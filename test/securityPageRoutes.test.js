const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/securityPageRoutes');
const getHandler = (method, path, stackIndex = 1) => {
    const layer = router.stack.find(
        (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    locals: { csrfToken: 'test-csrf-token' },
    render: sinon.stub(),
    redirect: sinon.stub(),
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis()
});

describe('Security Page Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps GET /security/logs to a handler', () => {
        const handler = getHandler('get', '/security/logs');

        expect(handler).to.exist;
    });

    it('redirects the legacy logs page to the security module logs section', async () => {
        const handler = getHandler('get', '/security/logs');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/security/module#logs')).to.be.true;
    });

    it('maps GET /security/correlations to a handler', () => {
        const handler = getHandler('get', '/security/correlations');

        expect(handler).to.exist;
    });

    it('maps GET /security/automation to a handler', () => {
        const handler = getHandler('get', '/security/automation');

        expect(handler).to.exist;
    });

    it('maps GET /security/module to a handler', () => {
        const handler = getHandler('get', '/security/module');

        expect(handler).to.exist;
    });

    it('redirects the legacy correlations page to the security module correlations section', async () => {
        const handler = getHandler('get', '/security/correlations');
        const userId = new mongoose.Types.ObjectId();

        const req = { user: { _id: userId } };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/security/module#correlations')).to.be.true;
    });

    it('redirects the legacy automation route to the security module automation section', async () => {
        const handler = getHandler('get', '/security/automation');
        const userId = new mongoose.Types.ObjectId();

        const req = { user: { _id: userId } };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/security/module#automation')).to.be.true;
    });

    it('renders the security module with runtime automation status', async () => {
        const handler = getHandler('get', '/security/module');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            user: { _id: userId },
            app: {
                locals: {
                    runtimeConfig: {
                        automation: {
                            logBatch: {
                                enabled: true,
                                source: 'server-log-batch',
                                intervalMs: 60000,
                                dedupeWindowMs: 300000,
                                maxReadBytes: 65536,
                                filePath: 'C:\\logs\\app.log'
                            },
                            scanBatch: {
                                enabled: false
                            }
                        }
                    }
                }
            }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/security-automation.ejs');
        expect(res.render.firstCall.args[1].title).to.equal('Security Module');
        expect(res.render.firstCall.args[1].automation.anyEnabled).to.equal(true);
        expect(res.render.firstCall.args[1].automation.logBatch.filePath).to.equal('C:\\logs\\app.log');
        expect(res.render.firstCall.args[1].automation.scanBatch.statusLabel).to.equal('Disabled');
    });
});
