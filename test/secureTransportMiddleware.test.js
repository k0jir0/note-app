const { expect } = require('chai');
const sinon = require('sinon');

const {
    buildSecureRedirectTarget,
    enforceSecureTransport,
    requestUsesSecureTransport
} = require('../src/middleware/secureTransport');

function buildReq(overrides = {}) {
    return {
        method: 'GET',
        originalUrl: '/notes',
        path: '/notes',
        secure: false,
        socket: {},
        app: {
            locals: {
                appBaseUrl: 'https://note-app.example.com',
                transportSecurity: {
                    secureTransportRequired: true
                }
            }
        },
        get: sinon.stub().returns(''),
        ...overrides
    };
}

function buildRes() {
    return {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis(),
        redirect: sinon.stub(),
        type: sinon.stub().returnsThis(),
        send: sinon.stub()
    };
}

describe('secure transport middleware', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('recognizes secure requests from Express or trusted proxy metadata', () => {
        const secureReq = buildReq({ secure: true });
        const proxiedReq = buildReq({
            get: sinon.stub().withArgs('x-forwarded-proto').returns('https')
        });

        expect(requestUsesSecureTransport(secureReq)).to.equal(true);
        expect(requestUsesSecureTransport(proxiedReq)).to.equal(true);
    });

    it('builds a secure redirect target from the configured app base URL', () => {
        const req = buildReq({
            originalUrl: '/auth/login?next=%2Fnotes'
        });

        expect(buildSecureRedirectTarget(req)).to.equal('https://note-app.example.com/auth/login?next=%2Fnotes');
    });

    it('passes through when secure transport is not required', () => {
        const req = buildReq({
            app: {
                locals: {
                    appBaseUrl: 'http://localhost:3000',
                    transportSecurity: {
                        secureTransportRequired: false
                    }
                }
            }
        });
        const res = buildRes();
        const next = sinon.stub();

        enforceSecureTransport(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.redirect.called).to.equal(false);
    });

    it('redirects insecure page requests to the configured HTTPS origin', () => {
        const req = buildReq();
        const res = buildRes();
        const next = sinon.stub();

        enforceSecureTransport(req, res, next);

        expect(res.redirect.calledOnceWithExactly(308, 'https://note-app.example.com/notes')).to.equal(true);
        expect(next.called).to.equal(false);
    });

    it('rejects insecure API requests with a structured error', () => {
        const req = buildReq({
            method: 'POST',
            originalUrl: '/api/notes',
            path: '/api/notes'
        });
        const res = buildRes();
        const next = sinon.stub();

        enforceSecureTransport(req, res, next);

        expect(res.status.calledOnceWithExactly(400)).to.equal(true);
        expect(res.json.calledOnce).to.equal(true);
        expect(next.called).to.equal(false);
    });
});
