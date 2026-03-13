const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { handlePageError } = require('../utils/errorHandler');

router.get('/notes/new', requireAuth, (req, res) => {
    res.render('pages/note-form.ejs', { note: null });
});

router.get('/notes', requireAuth, async (req, res) => {
    try {
        const notes = await Notes.find({ user: req.user._id }).sort({ updatedAt: -1 });

        res.render('pages/home.ejs', {
            title: 'Note App',
            notes: notes
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load notes');
    }
});

router.get('/research', requireAuth, (req, res) => {
    res.render('pages/research.ejs', {
        title: 'Research'
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

        res.render('pages/note.ejs', { note });
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

        res.render('pages/note-form.ejs', { note });
    } catch (error) {
        handlePageError(res, error, 'Unable to load note for editing');
    }
});


module.exports = router;
