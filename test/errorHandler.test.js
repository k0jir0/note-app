const { expect } = require('chai');

const {
    handleAuthFailure,
    handleApiError,
    handlePageError
} = require('../src/utils/errorHandler');

describe('errorHandler sanitization', () => {
    function createJsonResponseDouble() {
        return {
            statusCode: 200,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.payload = payload;
                return this;
            }
        };
    }

    function createSendResponseDouble() {
        return {
            statusCode: 200,
            body: '',
            status(code) {
                this.statusCode = code;
                return this;
            },
            send(body) {
                this.body = body;
                return this;
            }
        };
    }

    it('does not expose raw cast error metadata in API responses', () => {
        const res = createJsonResponseDouble();

        handleApiError(res, {
            name: 'CastError',
            message: 'Cast to ObjectId failed for value "Apache/2.4.41" at path "_id"'
        }, 'Lookup note');

        expect(res.statusCode).to.equal(400);
        expect(res.payload).to.deep.equal({
            success: false,
            message: 'Invalid data format',
            errors: ['The request included an invalid identifier or value.']
        });
    });

    it('sanitizes page error text that contains server banner metadata', () => {
        const res = createSendResponseDouble();

        handlePageError(res, {
            status: 400,
            message: 'Upstream reported Server: Apache/2.4.41 (Ubuntu)'
        }, 'Render page');

        expect(res.statusCode).to.equal(400);
        expect(res.body).to.equal('Request could not be completed.');
    });

    it('returns generic auth failure payloads for api requests', () => {
        const res = createJsonResponseDouble();

        handleAuthFailure(res, {
            api: true,
            statusCode: 401,
            errors: ['Authentication could not be completed. Please try again.']
        });

        expect(res.statusCode).to.equal(401);
        expect(res.payload).to.deep.equal({
            success: false,
            message: 'Unauthorized',
            errors: ['Authentication could not be completed. Please try again.']
        });
    });

    it('returns a service-unavailable message for auth service outages', () => {
        const res = createJsonResponseDouble();

        handleAuthFailure(res, {
            api: true,
            statusCode: 503,
            errors: ['Authentication is temporarily unavailable. Please try again.']
        });

        expect(res.statusCode).to.equal(503);
        expect(res.payload).to.deep.equal({
            success: false,
            message: 'Service Unavailable',
            errors: ['Authentication is temporarily unavailable. Please try again.']
        });
    });
});
