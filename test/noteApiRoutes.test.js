const { expect } = require('chai');

const router = require('../src/routes/noteApiRoutes');
const noteApiController = require('../src/controllers/noteApiController');
const { requireAuthAPI } = require('../src/middleware/auth');

const findRouteLayer = (method, path) => {
    return router.stack.find(
        (layer) =>
            layer.route &&
			layer.route.path === path &&
			layer.route.methods[method]
    );
};

describe('Note API Routes', () => {
    it('registers all note routes', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);

        expect(routeLayers).to.have.length(5);
    });

    it('maps GET /api/notes to getAllNotes with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/notes');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(
            noteApiController.getAllNotes
        );
    });

    it('maps GET /api/notes/:id to getNote with auth middleware', () => {
        const layer = findRouteLayer('get', '/api/notes/:id');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(
            noteApiController.getNote
        );
    });

    const { validateCreateNote, validateUpdateNote } = require('../src/middleware/requestValidator');

    it('maps POST /api/notes to createNote with auth middleware', () => {
        const layer = findRouteLayer('post', '/api/notes');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(validateCreateNote);
        expect(layer.route.stack[2].handle).to.equal(
            noteApiController.createNote
        );
    });

    it('maps PUT /api/notes/:id to updateNote with auth middleware', () => {
        const layer = findRouteLayer('put', '/api/notes/:id');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(3);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(validateUpdateNote);
        expect(layer.route.stack[2].handle).to.equal(
            noteApiController.updateNote
        );
    });

    it('maps DELETE /api/notes/:id to deleteNote with auth middleware', () => {
        const layer = findRouteLayer('delete', '/api/notes/:id');

        expect(layer).to.exist;
        expect(layer.route.stack).to.have.length(2);
        expect(layer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(layer.route.stack[1].handle).to.equal(
            noteApiController.deleteNote
        );
    });
});
