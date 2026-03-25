const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { handlePageError } = require('../utils/errorHandler');
const { buildAutomationSection } = require('../utils/automationViewModel');
const noteService = require('../services/noteService');

router.get('/notes/new', requireAuth, (req, res) => {
    res.render('pages/note-form.ejs', {
        note: null,
        csrfToken: res.locals.csrfToken
    });
});

router.get('/notes', requireAuth, async (req, res) => {
    try {
        const notes = await noteService.listNotesForUser(req.user._id);

        res.render('pages/home.ejs', {
            title: 'Note App',
            notes: notes,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load notes');
    }
});

router.get('/research', requireAuth, (req, res) => {
    const runtimeConfig = req.app && req.app.locals ? req.app.locals.runtimeConfig : {};
    const automation = runtimeConfig && runtimeConfig.automation ? runtimeConfig.automation : {};

    res.render('pages/research.ejs', {
        title: 'Research',
        csrfToken: res.locals.csrfToken,
        workspace: {
            automation: {
                anyEnabled: Boolean((automation.logBatch && automation.logBatch.enabled)
                    || (automation.scanBatch && automation.scanBatch.enabled)),
                enabledCount: Number(Boolean(automation.logBatch && automation.logBatch.enabled))
                    + Number(Boolean(automation.scanBatch && automation.scanBatch.enabled)),
                logBatch: buildAutomationSection(automation.logBatch, {
                    source: 'server-log-batch',
                    intervalMs: 60000,
                    dedupeWindowMs: 300000,
                    maxReadBytes: 65536
                }),
                scanBatch: buildAutomationSection(automation.scanBatch, {
                    source: 'scheduled-scan-import',
                    intervalMs: 300000,
                    dedupeWindowMs: 3600000
                })
            }
        }
    });
});

router.get('/notes/:id', requireAuth, async (req, res) => {
    try {
        const noteResult = await noteService.getNoteForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (!noteResult.ok) {
            return res.status(404).send('Note not found or access denied');
        }

        res.render('pages/note.ejs', {
            note: noteResult.note,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load note');
    }
});

router.get('/notes/:id/edit', requireAuth, async (req, res) => {
    try {
        const noteResult = await noteService.getNoteForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).send('Invalid note ID');
        }

        if (!noteResult.ok) {
            return res.status(404).send('Note not found or access denied');
        }

        res.render('pages/note-form.ejs', {
            note: noteResult.note,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load note for editing');
    }
});

// Handle form submission for creating a note (server-rendered flow)
router.post('/notes', requireAuth, async (req, res) => {
    try {
        const payload = req.body || {};
        const noteResult = await noteService.createNoteForUser(payload, req.user._id);
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
        handlePageError(res, error, 'Unable to create note');
    }
});

// Handle form submission for updating a note (server-rendered flow)
router.post('/notes/:id', requireAuth, async (req, res) => {
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
        handlePageError(res, error, 'Unable to update note');
    }
});


module.exports = router;
