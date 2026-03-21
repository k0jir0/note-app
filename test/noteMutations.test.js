const { expect } = require('chai');

const { buildCreateNoteData, buildUpdateNoteData } = require('../src/utils/noteMutations');

describe('Note Mutation utilities', () => {
    it('ignores csrf form fields when building a create payload', () => {
        const result = buildCreateNoteData({
            _csrf: 'test-token',
            title: 'Valid Title',
            content: '  Some content  ',
            image: ''
        }, 'user-123');

        expect(result.isValid).to.be.true;
        expect(result.inputData).to.deep.equal({
            title: 'Valid Title',
            content: '  Some content  ',
            image: ''
        });
        expect(result.data).to.deep.equal({
            title: 'Valid Title',
            content: 'Some content',
            image: '',
            user: 'user-123'
        });
    });

    it('returns field errors for invalid updates after ignored fields are stripped', () => {
        const result = buildUpdateNoteData({
            _csrf: 'test-token',
            title: ' '
        });

        expect(result.isValid).to.be.false;
        expect(result.message).to.equal('Validation failed');
        expect(result.fieldErrors).to.deep.equal({
            title: 'Title is required and must be a string'
        });
    });
});
