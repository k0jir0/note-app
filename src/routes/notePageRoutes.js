const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { handlePageError } = require('../utils/errorHandler');
const { validateNoteData, sanitizeNoteData } = require('../utils/validation');

function buildAutomationSection(config, defaults) {
    if (!config || !config.enabled) {
        return {
            enabled: false,
            statusLabel: 'Disabled',
            statusTone: 'secondary',
            source: defaults.source,
            intervalMs: defaults.intervalMs,
            dedupeWindowMs: defaults.dedupeWindowMs,
            filePath: null,
            maxReadBytes: defaults.maxReadBytes || null
        };
    }

    return {
        enabled: true,
        statusLabel: 'Active',
        statusTone: 'success',
        source: config.source,
        intervalMs: config.intervalMs,
        dedupeWindowMs: config.dedupeWindowMs,
        filePath: config.filePath,
        maxReadBytes: config.maxReadBytes || null
    };
}

router.get('/notes/new', requireAuth, (req, res) => {
    res.render('pages/note-form.ejs', {
        note: null,
        csrfToken: res.locals.csrfToken
    });
});

router.get('/notes', requireAuth, async (req, res) => {
    try {
        const notes = await Notes.find({ user: req.user._id }).sort({ updatedAt: -1 });

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

        // Disallow unexpected fields from form
        const allowed = ['title', 'content', 'image'];
        const disallowed = Object.keys(payload).filter(f => !allowed.includes(f));
        if (disallowed.length) {
            return res.status(400).render('pages/note-form.ejs', {
                note: payload,
                errors: [`Unexpected field(s): ${disallowed.join(', ')}`],
                fieldErrors: {},
                csrfToken: res.locals.csrfToken
            });
        }

        const sanitized = sanitizeNoteData(payload);
        const validation = validateNoteData(sanitized, false);
        if (!validation.isValid) {
            // Map generic validation messages to form fields when possible
            const fieldErrors = {};
            validation.errors.forEach(msg => {
                if (/title/i.test(msg)) fieldErrors.title = fieldErrors.title || msg;
                else if (/content/i.test(msg)) fieldErrors.content = fieldErrors.content || msg;
                else if (/image/i.test(msg)) fieldErrors.image = fieldErrors.image || msg;
            });

            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, payload),
                errors: validation.errors,
                fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        // All good — create the note
        const noteData = {
            title: sanitized.title,
            content: sanitized.content || '',
            image: sanitized.image || '',
            user: req.user._id
        };

        await Notes.create(noteData);
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
        const allowed = ['title', 'content', 'image'];
        const disallowed = Object.keys(payload).filter(f => !allowed.includes(f));
        if (disallowed.length) {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, payload, { _id: id }),
                errors: [`Unexpected field(s): ${disallowed.join(', ')}`],
                fieldErrors: {},
                csrfToken: res.locals.csrfToken
            });
        }

        const sanitized = sanitizeNoteData(payload);
        const validation = validateNoteData(sanitized, true);
        if (!validation.isValid) {
            const fieldErrors = {};
            validation.errors.forEach(msg => {
                if (/title/i.test(msg)) fieldErrors.title = fieldErrors.title || msg;
                else if (/content/i.test(msg)) fieldErrors.content = fieldErrors.content || msg;
                else if (/image/i.test(msg)) fieldErrors.image = fieldErrors.image || msg;
            });

            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, payload, { _id: id }),
                errors: validation.errors,
                fieldErrors,
                csrfToken: res.locals.csrfToken
            });
        }

        // Prepare update object
        const update = {};
        if (sanitized.title !== undefined) update.title = sanitized.title;
        if (sanitized.content !== undefined) update.content = sanitized.content;
        if (sanitized.image !== undefined) update.image = sanitized.image;

        if (Object.keys(update).length === 0) {
            return res.status(400).render('pages/note-form.ejs', {
                note: Object.assign({}, payload, { _id: id }),
                errors: ['Please provide at least one field to update'],
                fieldErrors: {},
                csrfToken: res.locals.csrfToken
            });
        }

        const note = await Notes.findOneAndUpdate({ _id: id, user: req.user._id }, update, { new: true });
        if (!note) {
            return res.status(404).send('Note not found or access denied');
        }

        return res.redirect(`/notes/${note._id}`);
    } catch (error) {
        handlePageError(res, error, 'Unable to update note');
    }
});


module.exports = router;
