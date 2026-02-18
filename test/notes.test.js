const {expect} = require('chai');
const mongoose = require('mongoose');

const Note = require('../src/models/Notes');

describe('Note Model', () => {
    it('Should be invalid if title is missing', () => {
        const note = new Note({
            content: 'A note without a title.',
            user: new mongoose.Types.ObjectId()
        });

        const error = note.validateSync();

        expect(error.errors.title).to.exist;
    });

    it('Should be invalid if user is missing', () => {
        const note = new Note({
            title: 'Note without user'
        });

        const error = note.validateSync();

        expect(error.errors.user).to.exist;
    });

    it('Should be valid with required fields only (title and user)', () => {
        const note = new Note({
            title: 'Simple Note',
            user: new mongoose.Types.ObjectId()
        });

        const error = note.validateSync();

        expect(error).to.not.exist;
    });

    it('Should default content to empty string', () => {
        const note = new Note({
            title: 'Note with default content',
            user: new mongoose.Types.ObjectId()
        });

        expect(note.content).to.equal('');
    });

    it('Should default image to empty string', () => {
        const note = new Note({
            title: 'Note with default image',
            user: new mongoose.Types.ObjectId()
        });

        expect(note.image).to.equal('');
    });

    it('Should accept content and image fields', () => {
        const note = new Note({
            title: 'Full Note',
            content: 'This is my note content',
            image: 'https://example.com/image.jpg',
            user: new mongoose.Types.ObjectId()
        });

        const error = note.validateSync();

        expect(error).to.not.exist;
        expect(note.title).to.equal('Full Note');
        expect(note.content).to.equal('This is my note content');
        expect(note.image).to.equal('https://example.com/image.jpg');
    });

    it('Should trim whitespace from title', () => {
        const note = new Note({
            title: '  Trimmed Title  ',
            user: new mongoose.Types.ObjectId()
        });

        expect(note.title).to.equal('Trimmed Title');
    });

    it('Should have timestamps after creation', () => {
        const note = new Note({
            title: 'Timestamped Note',
            user: new mongoose.Types.ObjectId()
        });

        // After saving, createdAt and updatedAt would be set
        // In validateSync, these won't exist yet, but schema has them
        expect(note.schema.paths.createdAt).to.exist;
        expect(note.schema.paths.updatedAt).to.exist;
    });

    it('Should validate user as ObjectId type', () => {
        const note = new Note({
            title: 'Valid User ID',
            user: new mongoose.Types.ObjectId()
        });

        const error = note.validateSync();

        expect(error).to.not.exist;
        expect(note.user).to.be.instanceOf(mongoose.Types.ObjectId);
    });
});
