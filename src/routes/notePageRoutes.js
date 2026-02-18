const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Notes = require('../models/notes');
const mongoose = require('mongoose');

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
        res.status(500).render('pages/home.ejs', {
            title: 'Note App',
            notes: []
        });
    }
});

router.get('/notes/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

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
        res.status(500).send('Error loading note');
    }
});

router.get('/notes/:id/edit', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

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
        res.status(500).send('Error loading note');
    }
});


module.exports = router;
