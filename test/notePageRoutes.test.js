const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/notePageRoutes');
const Notes = require('../src/models/Notes');
const noteImageAssetService = require('../src/services/noteImageAssetService');

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
    locals: { csrfToken: 'test-csrf-token' },
    render: sinon.stub(),
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    set: sinon.stub().returnsThis(),
    type: sinon.stub().returnsThis(),
    sendFile: sinon.stub().returnsThis()
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

    it('maps GET /notes/:id/image to a handler', () => {
        const handler = getHandler('get', '/notes/:id/image');

        expect(handler).to.exist;
    });

    it('maps GET /research to a handler', () => {
        const handler = getHandler('get', '/research');

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
            res.render.calledWith('pages/note-form.ejs', {
                note: null,
                csrfToken: 'test-csrf-token'
            })
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
            select: sinon.stub().returnsThis(),
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
                notes: fakeNotes,
                csrfToken: 'test-csrf-token'
            })
        ).to.be.true;
    });

    it('renders the research page for GET /research', async () => {
        const handler = getHandler('get', '/research');
        const userId = new mongoose.Types.ObjectId();

        const req = {
            user: { _id: userId },
            app: {
                locals: {
                    runtimeConfig: {
                        automation: {
                            logBatch: {
                                enabled: true,
                                source: 'server-log-batch',
                                intervalMs: 60000,
                                dedupeWindowMs: 300000,
                                maxReadBytes: 65536,
                                filePath: 'C:\\logs\\app.log'
                            },
                            scanBatch: {
                                enabled: false
                            }
                        }
                    }
                }
            }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.render.calledOnce).to.equal(true);
        expect(res.render.firstCall.args[0]).to.equal('pages/research.ejs');
        expect(res.render.firstCall.args[1]).to.deep.include({
            title: 'Research',
            csrfToken: 'test-csrf-token'
        });
        expect(res.render.firstCall.args[1].workspace.automation).to.deep.equal({
            anyEnabled: true,
            enabledCount: 1,
            logBatch: {
                enabled: true,
                statusLabel: 'Active',
                statusTone: 'success',
                source: 'server-log-batch',
                intervalMs: 60000,
                dedupeWindowMs: 300000,
                filePath: 'C:\\logs\\app.log',
                maxReadBytes: 65536
            },
            scanBatch: {
                enabled: false,
                statusLabel: 'Disabled',
                statusTone: 'secondary',
                source: 'scheduled-scan-import',
                intervalMs: 300000,
                dedupeWindowMs: 3600000,
                filePath: null,
                maxReadBytes: null
            }
        });
        expect(res.render.firstCall.args[1].workspace.modules).to.be.an('array').that.is.not.empty;
        expect(res.render.firstCall.args[1].workspace.modules[0]).to.deep.include({
            title: 'Security Operations Module',
            href: '/security/module',
            badgeText: '1/2 automation pollers active'
        });
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
        expect(res.send.called).to.be.true;
        expect(res.send.firstCall.args[0]).to.include('Unable to load notes');
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
            res.render.calledWith('pages/note.ejs', {
                note: fakeNote,
                csrfToken: 'test-csrf-token'
            })
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
            res.render.calledWith('pages/note-form.ejs', {
                note: fakeNote,
                csrfToken: 'test-csrf-token'
            })
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

    it('streams a managed note image for an owned note', async () => {
        const handler = getHandler('get', '/notes/:id/image');
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOne').resolves({
            _id: noteId,
            title: 'Test Note',
            content: 'Test content',
            image: 'https://example.com/image.jpg',
            imageAssetKey: 'note-asset.jpg',
            imageAssetContentType: 'image/jpeg',
            user: userId
        });
        sinon.stub(noteImageAssetService, 'resolveStoredAssetPath').returns('C:\\temp\\note-asset.jpg');

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = buildRes();

        await handler(req, res);

        expect(res.type.calledWith('image/jpeg')).to.be.true;
        expect(res.sendFile.calledWith('C:\\temp\\note-asset.jpg')).to.be.true;
    });
});

