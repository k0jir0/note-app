const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/notePageRoutes');
const Notes = require('../src/models/Notes');

const getHandler = (method, path, stackIndex = 1) => {
    const layer = router.stack.find(
        (entry) =>
            entry.route &&
			entry.route.path === path &&
			entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    render: sinon.stub(),
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis()
});

describe('Note Page Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps GET /notes/new to a handler', () => {
        const handler = getHandler('get', '/notes/new');

        expect(handler).to.exist;
    });

    it('maps GET /notes to a handler', () => {
        const handler = getHandler('get', '/notes');

        expect(handler).to.exist;
    });

    it('maps GET /notes/:id to a handler', () => {
        const handler = getHandler('get', '/notes/:id');

        expect(handler).to.exist;
    });

    it('maps GET /notes/:id/edit to a handler', () => {
        const handler = getHandler('get', '/notes/:id/edit');

        expect(handler).to.exist;
    });

    it('renders the note form for GET /notes/new', async () => {
        const handler = getHandler('get', '/notes/new');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(
            res.render.calledWith('pages/note-form.ejs', { note: null })
        ).to.be.true;
    });

    it('renders the home page for GET /notes with user notes', async () => {
        const handler = getHandler('get', '/notes');
        const userId = new mongoose.Types.ObjectId();
        const fakeNotes = [
            { title: 'Note 1', content: 'Content 1', user: userId },
            { title: 'Note 2', content: 'Content 2', user: userId }
        ];

        sinon.stub(Notes, 'find').returns({
            sort: sinon.stub().resolves(fakeNotes)
        });

        const req = {
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(
            res.render.calledWith('pages/home.ejs', {
                title: 'Note App',
                notes: fakeNotes
            })
        ).to.be.true;
    });

    it('renders home page with empty notes on error for GET /notes', async () => {
        const handler = getHandler('get', '/notes');
        const userId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'find').throws(new Error('Database error'));

        const req = {
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.status.calledWith(500)).to.be.true;
        expect(
            res.render.calledWith('pages/home.ejs', {
                title: 'Note App',
                notes: []
            })
        ).to.be.true;
    });

    it('renders a single note for GET /notes/:id', async () => {
        const handler = getHandler('get', '/notes/:id');
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const fakeNote = {
            _id: noteId,
            title: 'Test Note',
            content: 'Test content',
            user: userId
        };

        sinon.stub(Notes, 'findOne').resolves(fakeNote);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(
            res.render.calledWith('pages/note.ejs', { note: fakeNote })
        ).to.be.true;
    });

    it('returns 400 for invalid ObjectId on GET /notes/:id', async () => {
        const handler = getHandler('get', '/notes/:id');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            params: { id: 'invalid-id' },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.send.calledWith('Invalid note ID')).to.be.true;
    });

    it('returns 404 if note not found on GET /notes/:id', async () => {
        const handler = getHandler('get', '/notes/:id');
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOne').resolves(null);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.send.calledWith('Note not found or access denied')).to.be.true;
    });

    it('renders the edit form for GET /notes/:id/edit', async () => {
        const handler = getHandler('get', '/notes/:id/edit');
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const fakeNote = {
            _id: noteId,
            title: 'Test Note',
            content: 'Test content',
            user: userId
        };

        sinon.stub(Notes, 'findOne').resolves(fakeNote);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(
            res.render.calledWith('pages/note-form.ejs', { note: fakeNote })
        ).to.be.true;
    });

    it('returns 400 for invalid ObjectId on GET /notes/:id/edit', async () => {
        const handler = getHandler('get', '/notes/:id/edit');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            params: { id: 'invalid-id' },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.send.calledWith('Invalid note ID')).to.be.true;
    });

    it('returns 404 if note not found on GET /notes/:id/edit', async () => {
        const handler = getHandler('get', '/notes/:id/edit');
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOne').resolves(null);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.send.calledWith('Note not found or access denied')).to.be.true;
    });
});

