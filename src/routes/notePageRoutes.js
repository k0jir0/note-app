const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { handlePageError } = require('../utils/errorHandler');
const { buildAutomationSection } = require('../utils/automationViewModel');
const { buildCreateNoteData, buildUpdateNoteData } = require('../utils/noteMutations');

const NOTE_LIST_SELECT = 'title content image createdAt updatedAt';

router.get('/notes/new', requireAuth, (req, res) => {
    res.render('pages/note-form.ejs', {
        note: null,
        csrfToken: res.locals.csrfToken
    });
});

router.get('/notes', requireAuth, async (req, res) => {
    try {
        const notes = await Notes.find({ user: req.user._id })
            .select(NOTE_LIST_SELECT)
            .sort({ updatedAt: -1 });

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
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('Invalid note ID');
        }

        // Find note and verify ownership
        const note = await Notes.findOne({ _id: id, user: req.user._id });

        if (!note) {
            return res.status(404).send('Note not found or access denied');
        }

        res.render('pages/note.ejs', {
            note,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load note');
    }
});

router.get('/notes/:id/edit', requireAuth, async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('Invalid note ID');
        }

        // Find note and verify ownership
        const note = await Notes.findOne({ _id: id, user: req.user._id });

        if (!note) {
            return res.status(404).send('Note not found or access denied');
        }

        res.render('pages/note-form.ejs', {
            note,
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
        const noteResult = buildCreateNoteData(payload, req.user._id);
        if (!noteResult.isValid) {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, noteResult.inputData),
                errors: noteResult.errors,
                fieldErrors: noteResult.fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        await Notes.create(noteResult.data);
        return res.redirect('/notes');
    } catch (error) {
        handlePageError(res, error, 'Unable to create note');
    }
});

// Handle form submission for updating a note (server-rendered flow)
router.post('/notes/:id', requireAuth, async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('Invalid note ID');
        }

        const payload = req.body || {};
        const updateResult = buildUpdateNoteData(payload);
        if (!updateResult.isValid) {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, updateResult.inputData, { _id: id }),
                errors: updateResult.errors,
                fieldErrors: updateResult.fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        const note = await Notes.findOneAndUpdate({ _id: id, user: req.user._id }, updateResult.data, { new: true });
        if (!note) {
            return res.status(404).send('Note not found or access denied');
        }

        return res.redirect(`/notes/${note._id}`);
    } catch (error) {
        handlePageError(res, error, 'Unable to update note');
    }
});


module.exports = router;
