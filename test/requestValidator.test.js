const { expect } = require('chai');
const { validateCreateNote, validateUpdateNote } = require('../src/middleware/requestValidator');

describe('Request Validator middleware', () => {
    it('calls next() for valid create payload', (done) => {
        const req = { body: { title: 'Valid Title', content: 'Some content' } };
        let nextCalled = false;

        const res = {
            status: (code) => ({ json: (payload) => {
                // Should not be called for valid payload
                throw new Error('Unexpected json call: ' + JSON.stringify(payload));
            }})
        };

        validateCreateNote(req, res, () => { nextCalled = true; done(); });
    });

    it('responds 400 for invalid create payload', () => {
        const req = { body: { title: 'a' } };
        let captured = null;
        const res = {
            status: (code) => ({ json: (payload) => { captured = { code, payload }; } })
        };

        validateCreateNote(req, res, () => { throw new Error('next should not be called'); });

        expect(captured).to.not.be.null;
        expect(captured.code).to.equal(400);
        expect(captured.payload).to.have.property('success', false);
        expect(captured.payload).to.have.property('errors').that.is.an('array');
    });

    it('calls next() for valid update payload', (done) => {
        const req = { body: { title: 'Updated Title' } };
        const res = {
            status: (code) => ({ json: (payload) => { throw new Error('Unexpected json call: ' + JSON.stringify(payload)); } })
        };

        validateUpdateNote(req, res, () => { done(); });
    });

    it('responds 400 for invalid update payload', () => {
        const req = { body: { title: '' } };
        let captured = null;
        const res = {
            status: (code) => ({ json: (payload) => { captured = { code, payload }; } })
        };

        validateUpdateNote(req, res, () => { throw new Error('next should not be called'); });

        expect(captured).to.not.be.null;
        expect(captured.code).to.equal(400);
        expect(captured.payload).to.have.property('success', false);
    });
});
