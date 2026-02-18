const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const router = require('../src/routes/noteRoutes');
const noteController = require('../src/controllers/noteController');
const Notes = require('../src/models/Notes');

const getLayers = (method, path) => {
    return router.stack.filter(
        (layer) =>
            layer.route &&
			layer.route.path === path &&
			layer.route.methods[method]
    );
};

describe('Note Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('registers 2 routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(2);
    });

    it('GET / maps to noteController.getAllNotes with auth middleware', () => {
        const layers = getLayers('get', '/');

        expect(layers).to.have.length(1);
        expect(layers[0].route.stack).to.have.length(2);
    });

    it('GET / calls noteController.getAllNotes', async () => {
        const userId = new mongoose.Types.ObjectId();
        const fakeNotes = [{ title: 'Test Note', user: userId }];

        sinon.stub(Notes, 'find').returns({
            sort: sinon.stub().resolves(fakeNotes)
        });

        const req = {
            user: { _id: userId }
        };
        const res = {
            render: sinon.stub()
        };

        await noteController.getAllNotes(req, res);

        expect(res.render.calledWith('pages/home', {
            title: 'Note App',
            notes: fakeNotes
        })).to.be.true;
    });

    it('GET /note/:id calls noteController.getNote with auth middleware', () => {
        const layers = getLayers('get', '/note/:id');

        expect(layers).to.have.length(1);
        expect(layers[0].route.stack).to.have.length(2);
    });

    it('GET /note/:id renders note if owned by user', async () => {
        const userId = new mongoose.Types.ObjectId();
        const noteId = new mongoose.Types.ObjectId();
        const fakeNote = { _id: noteId, title: 'Test', user: userId };

        sinon.stub(Notes, 'findOne').resolves(fakeNote);

        const req = {
            params: { id: noteId.toString() },
            user: { _id: userId }
        };
        const res = {
            render: sinon.stub(),
            status: sinon.stub().returnsThis(),
            send: sinon.stub()
        };

        await noteController.getNote(req, res);

        expect(res.render.calledWith('pages/note', { note: fakeNote })).to.be.true;
    });
});
