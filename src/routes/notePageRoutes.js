const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { handlePageError } = require('../utils/errorHandler');

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


module.exports = router;
