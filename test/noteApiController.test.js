const {expect} = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const noteApiController = require('../src/controllers/noteApiController');
const Notes = require('../src/models/Notes');

describe('Note API Controller - getAllNotes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should return all notes for the authenticated user with status 200', async () => {
        const userId = new mongoose.Types.ObjectId();
        const fakeNotes = [
            {
                title: 'Meeting Notes',
                content: 'Discussed Q1 goals',
                user: userId
            },
            {
                title: 'Shopping List',
                content: 'Milk, Eggs, Bread',
                user: userId
            }
        ];

        const findStub = sinon.stub(Notes, 'find');
        findStub.returns({
            sort: sinon.stub().returnsThis(),
            skip: sinon.stub().returnsThis(),
            limit: sinon.stub().resolves(fakeNotes)
        });
        sinon.stub(Notes, 'countDocuments').resolves(2);

        const req = {
            user: { _id: userId },
            query: {}
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.getAllNotes(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.called).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(true);
        expect(res.json.firstCall.args[0].data).to.deep.equal(fakeNotes);
        expect(res.json.firstCall.args[0].count).to.equal(2);
        expect(res.json.firstCall.args[0].pagination).to.exist;
        expect(res.json.firstCall.args[0].pagination.totalCount).to.equal(2);
    });

    it('should return 500 if there is a server error', async () => {
        const userId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'find').throws(new Error('Database error'));

        const req = {
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.getAllNotes(req, res);

        expect(res.status.calledWith(500)).to.be.true;
        expect(res.json.called).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
        expect(res.json.firstCall.args[0].message).to.equal('Server Error');
    });
});

describe('Note API Controller - getNote', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should return a note if it exists and belongs to user', async () => {
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
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.getNote(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(true);
        expect(res.json.firstCall.args[0].data).to.deep.equal(fakeNote);
    });

    it('should return 400 for invalid ObjectId', async () => {
        const userId = new mongoose.Types.ObjectId();

        const req = {
            params: { id: 'invalid-id' },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.getNote(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });

    it('should return 404 if note not found or not owned by user', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOne').resolves(null);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.getNote(req, res);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });
});

describe('Note API Controller - createNote', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should create a new note with valid data and return 201', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteData = {
            title: 'New Note',
            content: 'New content',
            image: 'https://example.com/image.jpg'
        };
        const createdNote = {
            ...noteData,
            user: userId,
            _id: new mongoose.Types.ObjectId()
        };

        sinon.stub(Notes, 'create').resolves(createdNote);

        const req = {
            body: noteData,
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.createNote(req, res);

        expect(res.status.calledWith(201)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(true);
        expect(res.json.firstCall.args[0].data).to.deep.equal(createdNote);
    });

    it('should return 400 if request body is empty', async () => {
        const userId = new mongoose.Types.ObjectId();

        const req = {
            body: {},
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.createNote(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });

    it('should return 400 if title is missing', async () => {
        const userId = new mongoose.Types.ObjectId();

        const req = {
            body: { content: 'Content without title' },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.createNote(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });
});

describe('Note API Controller - updateNote', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should update a note and return 200', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const updatedNote = {
            _id: noteId,
            title: 'Updated Title',
            content: 'Updated content',
            user: userId
        };

        sinon.stub(Notes, 'findOneAndUpdate').resolves(updatedNote);

        const req = {
            params: { id: noteId.toString() },
            body: { title: 'Updated Title', content: 'Updated content' },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.updateNote(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(true);
        expect(res.json.firstCall.args[0].data).to.deep.equal(updatedNote);
    });

    it('should return 400 for empty request body', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        const req = {
            params: { id: noteId.toString() },
            body: {},
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.updateNote(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });

    it('should return 404 if note not found', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOneAndUpdate').resolves(null);

        const req = {
            params: { id: noteId.toString() },
            body: { title: 'Updated' },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.updateNote(req, res);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });
});

describe('Note API Controller - deleteNote', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should delete a note and return 200', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const deletedNote = {
            _id: noteId,
            title: 'Deleted Note',
            user: userId
        };

        sinon.stub(Notes, 'findOneAndDelete').resolves(deletedNote);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.deleteNote(req, res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(true);
        expect(res.json.firstCall.args[0].data).to.deep.equal(deletedNote);
    });

    it('should return 400 for invalid ObjectId', async () => {
        const userId = new mongoose.Types.ObjectId();

        const req = {
            params: { id: 'invalid-id' },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.deleteNote(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });

    it('should return 404 if note not found', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();

        sinon.stub(Notes, 'findOneAndDelete').resolves(null);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        await noteApiController.deleteNote(req, res);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.json.firstCall.args[0].success).to.equal(false);
    });
});
