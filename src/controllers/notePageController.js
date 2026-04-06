const { handlePageError } = require('../utils/errorHandler');
const noteService = require('../services/noteService');
const noteImageAssetService = require('../services/noteImageAssetService');
const { buildResearchWorkspaceViewModel } = require('../services/researchWorkspaceService');

function renderNoteForm(req, res) {
    return res.render('pages/note-form.ejs', {
        note: null,
        csrfToken: res.locals.csrfToken
    });
}

async function renderNotesHome(req, res) {
    try {
        const notes = await noteService.listNotesForUser(req.user._id);

        return res.render('pages/home.ejs', {
            title: 'Helios',
            notes,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        return handlePageError(res, error, 'Unable to load notes');
    }
}

function renderResearchWorkspace(req, res) {
    const runtimeConfig = req.app && req.app.locals ? req.app.locals.runtimeConfig : {};

    return res.render('pages/research.ejs', {
        title: 'Research',
        csrfToken: res.locals.csrfToken,
        workspace: buildResearchWorkspaceViewModel(runtimeConfig)
    });
}

async function renderNoteImage(req, res) {
    try {
        const noteResult = await noteService.ensureNoteImageAssetForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (!noteResult.ok || !noteResult.note || !noteResult.note.imageAssetKey) {
            return res.status(404).send('Note image not found');
        }

        const assetPath = noteImageAssetService.resolveStoredAssetPath(noteResult.note.imageAssetKey);
        res.set('Cache-Control', 'private, max-age=3600');
        if (noteResult.note.imageAssetContentType) {
            res.type(noteResult.note.imageAssetContentType);
        }

        return res.sendFile(assetPath);
    } catch (error) {
        return handlePageError(res, error, 'Unable to load note image');
    }
}

async function renderNoteDetail(req, res) {
    try {
        const noteResult = await noteService.getNoteForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (!noteResult.ok) {
            return res.status(404).send('Note not found or access denied');
        }

        return res.render('pages/note.ejs', {
            note: noteResult.note,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        return handlePageError(res, error, 'Unable to load note');
    }
}

async function renderEditNoteForm(req, res) {
    try {
        const noteResult = await noteService.getNoteForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (!noteResult.ok) {
            return res.status(404).send('Note not found or access denied');
        }

        return res.render('pages/note-form.ejs', {
            note: noteResult.note,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        return handlePageError(res, error, 'Unable to load note for editing');
    }
}

async function createNoteFromPage(req, res) {
    try {
        const noteResult = await noteService.createNoteForUser(req.body || {}, req.user._id);
        if (!noteResult.ok) {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, noteResult.inputData),
                errors: noteResult.errors,
                fieldErrors: noteResult.fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        return res.redirect('/notes');
    } catch (error) {
        return handlePageError(res, error, 'Unable to create note');
    }
}

async function updateNoteFromPage(req, res) {
    try {
        const updateResult = await noteService.updateNoteForUser(req.user._id, req.params.id, req.body);
        if (updateResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (updateResult.kind === 'validation') {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, updateResult.inputData, { _id: updateResult.id }),
                errors: updateResult.errors,
                fieldErrors: updateResult.fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        if (!updateResult.ok) {
            return res.status(404).send('Note not found or access denied');
        }

        return res.redirect(`/notes/${updateResult.note._id}`);
    } catch (error) {
        return handlePageError(res, error, 'Unable to update note');
    }
}

module.exports = {
    createNoteFromPage,
    renderEditNoteForm,
    renderNoteDetail,
    renderNoteForm,
    renderNoteImage,
    renderNotesHome,
    renderResearchWorkspace,
    updateNoteFromPage
};
