const Notes = require('../models/Notes');
const { handlePageError } = require('../utils/errorHandler');

exports.getAllNotes = async (req, res) => {
    try {
        // Only get notes for the authenticated user
        const notes = await Notes.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.render('pages/home', { title: 'Note App', notes: notes });
    } catch (error) {
        handlePageError(res, error, 'Unable to load notes');
    }
};

exports.getNote = async (req, res) => {
    try {
        // Find note and verify ownership
        const note = await Notes.findOne({ _id: req.params.id, user: req.user._id });
        if (!note) {
            return res.status(404).send('Note not found or access denied');
        }

        res.render('pages/note', { note });
    } catch (error) {
        handlePageError(res, error, 'Unable to load note');
    }
};
