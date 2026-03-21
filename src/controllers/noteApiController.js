const Notes = require('../models/Notes');
const mongoose = require('mongoose');
const { handleApiError } = require('../utils/errorHandler');
const { parsePaginationParams, createPaginationMeta } = require('../utils/pagination');
const { buildCreateNoteData, buildUpdateNoteData } = require('../utils/noteMutations');

const NOTE_LIST_SELECT = 'title content image createdAt updatedAt';

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// CREATE Operations
exports.createNote = async (req, res) => {
    try {
        const noteResult = buildCreateNoteData(req.body, req.user._id);
        if (!noteResult.isValid) {
            return res.status(400).json({
                success: false,
                message: noteResult.message,
                errors: noteResult.errors
            });
        }

        const note = await Notes.create(noteResult.data);

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: note
        });
    } catch (error) {
        handleApiError(res, error, 'Create note');
    }
};

// READ Operations
exports.getAllNotes = async (req, res) => {
    try {
        // Parse pagination parameters
        const { page, limit, skip } = parsePaginationParams(req.query);

        const [totalCount, notes] = await Promise.all([
            Notes.countDocuments({ user: req.user._id }),
            Notes.find({ user: req.user._id })
                .select(NOTE_LIST_SELECT)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
        ]);

        // Create pagination metadata
        const pagination = createPaginationMeta(totalCount, page, limit);

        res.status(200).json({
            success: true,
            count: notes.length,
            data: notes,
            pagination
        });
    } catch (error) {
        handleApiError(res, error, 'Get all notes');
    }
};

exports.getNote = async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

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
        handleApiError(res, error, 'Get note');
    }
};

// UPDATE Operations
exports.updateNote = async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

        // Validate ObjectId format
        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        const updateResult = buildUpdateNoteData(req.body);
        if (!updateResult.isValid) {
            return res.status(400).json({
                success: false,
                message: updateResult.message,
                errors: updateResult.errors
            });
        }

        // Find and update only if owned by user
        const note = await Notes.findOneAndUpdate(
            { _id: id, user: req.user._id },
            updateResult.data,
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
        handleApiError(res, error, 'Update note');
    }
};

// DELETE Operations
exports.deleteNote = async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

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
        handleApiError(res, error, 'Delete note');
    }
};
