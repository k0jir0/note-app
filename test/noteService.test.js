const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const Notes = require('../src/models/Notes');
const noteImageAssetService = require('../src/services/noteImageAssetService');
const noteService = require('../src/services/noteService');

describe('noteService managed image storage', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('stores a managed image asset when creating a note with an external image URL', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const createdNote = {
            _id: noteId,
            title: 'Remote image note',
            content: 'content',
            image: 'https://example.com/image.jpg',
            imageAssetKey: '',
            imageAssetContentType: '',
            user: userId
        };
        const updatedNote = {
            ...createdNote,
            imageAssetKey: 'asset-1.jpg',
            imageAssetContentType: 'image/jpeg'
        };

        sinon.stub(Notes, 'create').resolves(createdNote);
        sinon.stub(Notes, 'findOneAndUpdate').resolves(updatedNote);
        sinon.stub(noteImageAssetService, 'persistRemoteNoteImage').resolves({
            assetKey: 'asset-1.jpg',
            contentType: 'image/jpeg'
        });

        const result = await noteService.createNoteForUser({
            title: 'Remote image note',
            content: 'content',
            image: 'https://example.com/image.jpg'
        }, userId);

        expect(result.ok).to.equal(true);
        expect(result.note.imageAssetKey).to.equal('asset-1.jpg');
        expect(noteImageAssetService.persistRemoteNoteImage.calledOnce).to.equal(true);
    });

    it('removes the managed image asset when an updated note clears its image URL', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const existingNote = {
            _id: noteId,
            title: 'Existing note',
            content: 'content',
            image: 'https://example.com/image.jpg',
            imageAssetKey: 'asset-1.jpg',
            imageAssetContentType: 'image/jpeg',
            user: userId
        };
        const updatedNote = {
            ...existingNote,
            image: '',
            imageAssetKey: '',
            imageAssetContentType: ''
        };

        sinon.stub(Notes, 'findOne').resolves(existingNote);
        sinon.stub(Notes, 'findOneAndUpdate').resolves(updatedNote);
        sinon.stub(noteImageAssetService, 'deleteNoteImageAsset').resolves(true);

        const result = await noteService.updateNoteForUser(userId, noteId.toString(), {
            image: ''
        });

        expect(result.ok).to.equal(true);
        expect(result.note.image).to.equal('');
        expect(noteImageAssetService.deleteNoteImageAsset.calledOnce).to.equal(true);
    });

    it('backfills a missing managed asset on demand for an existing note image', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const existingNote = {
            _id: noteId,
            title: 'Existing note',
            content: 'content',
            image: 'https://example.com/image.jpg',
            imageAssetKey: '',
            imageAssetContentType: '',
            user: userId
        };
        const updatedNote = {
            ...existingNote,
            imageAssetKey: 'asset-2.jpg',
            imageAssetContentType: 'image/jpeg'
        };

        sinon.stub(Notes, 'findOne').resolves(existingNote);
        sinon.stub(noteImageAssetService, 'persistRemoteNoteImage').resolves({
            assetKey: 'asset-2.jpg',
            contentType: 'image/jpeg'
        });
        sinon.stub(Notes, 'findOneAndUpdate').resolves(updatedNote);

        const result = await noteService.ensureNoteImageAssetForUser(userId, noteId.toString());

        expect(result.ok).to.equal(true);
        expect(result.note.imageAssetKey).to.equal('asset-2.jpg');
    });
});
