const sinon = require('sinon');
const { expect } = require('chai');

const { enforceInjectionPrevention } = require('../src/middleware/injectionPrevention');

function buildResponse() {
    return {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis(),
        send: sinon.stub().returnsThis()
    };
}

describe('Injection prevention middleware', () => {
    it('rejects unsafe API payloads with a structured 400 response', () => {
        const req = {
            path: '/api/notes',
            body: {
                probe: {
                    $ne: null
                }
            },
            query: {},
            params: {},
            get: sinon.stub().returns('application/json')
        };
        const res = buildResponse();
        const next = sinon.stub();

        enforceInjectionPrevention(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(400)).to.equal(true);
        expect(res.json.calledOnce).to.equal(true);
        expect(res.json.firstCall.args[0].message).to.equal('Rejected potentially unsafe request input');
        expect(res.json.firstCall.args[0].errors[0]).to.include('body.probe.$ne');
    });

    it('rejects unsafe page requests with a plain 400 response', () => {
        const req = {
            path: '/notes',
            body: {
                profile: {
                    'access.level': 'admin'
                }
            },
            query: {},
            params: {},
            get: sinon.stub().returns('text/html')
        };
        const res = buildResponse();
        const next = sinon.stub();

        enforceInjectionPrevention(req, res, next);

        expect(next.called).to.equal(false);
        expect(res.status.calledWith(400)).to.equal(true);
        expect(res.send.calledWith('Rejected potentially unsafe request input')).to.equal(true);
    });

    it('allows safe requests to continue', () => {
        const req = {
            path: '/api/notes',
            body: {
                title: 'Safe request'
            },
            query: {},
            params: {},
            get: sinon.stub().returns('application/json')
        };
        const res = buildResponse();
        const next = sinon.stub();

        enforceInjectionPrevention(req, res, next);

        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
    });
});
