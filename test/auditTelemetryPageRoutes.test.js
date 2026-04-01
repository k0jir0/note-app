const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/auditTelemetryPageRoutes');

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
        redirect: sinon.stub(),
        status: sinon.stub().returnsThis(),
        send: sinon.stub().returnsThis()
    };
}

describe('Audit and telemetry page routes', () => {
    it('maps GET /audit-telemetry to a handler', () => {
        expect(getHandler('get', '/audit-telemetry')).to.exist;
    });

    it('maps GET /audit-telemetry/module to a handler', () => {
        expect(getHandler('get', '/audit-telemetry/module')).to.exist;
    });

    it('redirects GET /audit-telemetry to the module page', async () => {
        const handler = getHandler('get', '/audit-telemetry');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.redirect.calledWith('/audit-telemetry/module')).to.equal(true);
    });

    it('renders the audit and telemetry module page with runtime posture data', async () => {
        const handler = getHandler('get', '/audit-telemetry/module');
        const req = {
            user: { _id: new mongoose.Types.ObjectId() },
            app: {
                locals: {
                    immutableLogging: {
                        enabled: true,
                        endpoint: 'https://logs.example.test/append',
                        source: 'note-app',
                        timeoutMs: 2500,
                        format: 'syslog'
                    },
                    transportSecurity: {
                        protocol: 'https',
                        httpsEnabled: true,
                        tlsMinVersion: 'TLSv1.3',
                        tlsMaxVersion: 'TLSv1.3',
                        requestClientCertificate: true,
                        requireClientCertificate: false
                    },
                    runtimeConfig: {
                        immutableLogging: {
                            enabled: true,
                            endpoint: 'https://logs.example.test/append',
                            source: 'note-app',
                            timeoutMs: 2500,
                            format: 'syslog'
                        },
                        transport: {
                            protocol: 'https',
                            httpsEnabled: true,
                            tlsMinVersion: 'TLSv1.3',
                            tlsMaxVersion: 'TLSv1.3'
                        }
                    }
                }
            }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/audit-telemetry-module.ejs');
        expect(res.render.firstCall.args[1].title).to.equal('Audit Trail and Telemetry Module');
        expect(res.render.firstCall.args[1].csrfToken).to.equal('test-csrf-token');
        expect(res.render.firstCall.args[1].moduleData.summary.immutableLoggingEnabled).to.equal(true);
        expect(res.render.firstCall.args[1].moduleData.summary.format).to.equal('SYSLOG');
        expect(res.render.firstCall.args[1].moduleData.immutablePreview.syslogPayload).to.be.a('string');
        expect(res.render.firstCall.args[1].moduleData.telemetryCoverage).to.be.an('array').that.has.length(4);
    });
});
