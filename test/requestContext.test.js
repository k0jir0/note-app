const { expect } = require('chai');

const {
    getRequestContext,
    requestContextMiddleware
} = require('../src/utils/requestContext');

describe('request context middleware', () => {
    it('preserves inbound correlation ids and emits request headers', (done) => {
        const req = {
            headers: {
                'x-correlation-id': 'corr-ops-17'
            }
        };
        const responseHeaders = {};
        const res = {
            setHeader(name, value) {
                responseHeaders[name] = value;
            }
        };

        requestContextMiddleware(req, res, () => {
            const context = getRequestContext();
            expect(context).to.not.equal(null);
            expect(context.correlationId).to.equal('corr-ops-17');
            expect(context.requestId).to.be.a('string').and.not.empty;
            expect(req.correlationId).to.equal('corr-ops-17');
            expect(req.requestId).to.equal(context.requestId);
            expect(responseHeaders['X-Correlation-Id']).to.equal('corr-ops-17');
            expect(responseHeaders['X-Request-Id']).to.equal(context.requestId);
            done();
        });
    });
});
