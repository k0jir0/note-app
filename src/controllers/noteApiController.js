const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { validateNoteData, sanitizeNoteData } = require('../utils/validation');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to handle errors
const handleError = (res, error, _operation) => {
    // Validation errors (missing required fields, invalid data types)
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    // Cast errors (invalid data format)
    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid data format',
            error: error.message
        });
    }

    // Duplicate key errors
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry',
            error: 'A note with this information already exists'
        });
    }

    // Default server error
    return res.status(500).json({
        success: false,
        message: 'Server Error',
        error: error.message
    });
};

// CREATE Operations
exports.createNote = async (req, res) => {
    try {
        // Validate request body existence
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body cannot be empty',
                errors: ['Please provide note data']
            });
        }

        // Sanitize input data
        const sanitizedData = sanitizeNoteData(req.body);

        // Validate note data
        const validation = validateNoteData(sanitizedData, false);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }

        // Prepare note data with user ID
        const noteData = {
            title: sanitizedData.title,
            content: sanitizedData.content || '',
            image: sanitizedData.image || '',
            user: req.user._id
        };

        console.log('Creating note:', { ...noteData, user: req.user._id });
        const note = await Notes.create(noteData);

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: note
        });
    } catch (error) {
        handleError(res, error, 'Create note');
    }
};

// READ Operations
exports.getAllNotes = async (req, res) => {
    try {
        // Only get notes for the authenticated user
        const notes = await Notes.find({ user: req.user._id });

        res.status(200).json({
            success: true,
            count: notes.length,
            data: notes
        });
    } catch (error) {
        handleError(res, error, 'Get all notes');
    }
};

exports.getNote = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        // Find note and verify ownership
        const note = await Notes.findOne({ _id: id, user: req.user._id });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to view it']
            });
        }

        res.status(200).json({
            success: true,
            data: note
        });
    } catch (error) {
        handleError(res, error, 'Get note');
    }
};

// UPDATE Operations
exports.updateNote = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        // Validate request body
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body cannot be empty',
                errors: ['Please provide data to update']
            });
        }

        // Sanitize input data
        const sanitizedData = sanitizeNoteData(req.body);

        // Validate note data (for updates)
        const validation = validateNoteData(sanitizedData, true);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }

        // Prepare update data (don't allow user field to be updated)
        const updateData = {};
        if (sanitizedData.title !== undefined) updateData.title = sanitizedData.title;
        if (sanitizedData.content !== undefined) updateData.content = sanitizedData.content;
        if (sanitizedData.image !== undefined) updateData.image = sanitizedData.image;

        // Find and update only if owned by user
        const note = await Notes.findOneAndUpdate(
            { _id: id, user: req.user._id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to update it']
            });
        }

        res.status(200).json({
            success: true,
            message: 'Note updated successfully',
            data: note
        });
    } catch (error) {
        handleError(res, error, 'Update note');
    }
};

// DELETE Operations
exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        // Find and delete only if owned by user
        const note = await Notes.findOneAndDelete({ _id: id, user: req.user._id });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to delete it']
            });
        }

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully',
            data: note
        });
    } catch (error) {
        handleError(res, error, 'Delete note');
    }
};
