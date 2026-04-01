const { handleApiError } = require('../utils/errorHandler');
const { parsePaginationParams, createPaginationMeta } = require('../utils/pagination');
const noteService = require('../services/noteService');

// CREATE Operations
exports.createNote = async (req, res) => {
    try {
        const noteResult = await noteService.createNoteForUser(req.body, req.user._id);
        if (!noteResult.ok) {
            return res.status(400).json({
                success: false,
                message: noteResult.message,
                errors: noteResult.errors
            });
        }

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: noteResult.note
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
            noteService.countNotesForUser(req.user._id),
            noteService.listNotesForUser(req.user._id, { skip, limit })
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
        const noteResult = await noteService.getNoteForUser(req.user._id, req.params.id);
        if (noteResult.kind === 'invalid_id') {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        if (!noteResult.ok) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to view it']
            });
        }

        res.status(200).json({
            success: true,
            data: noteResult.note
        });
    } catch (error) {
        handleApiError(res, error, 'Get note');
    }
};

// UPDATE Operations
exports.updateNote = async (req, res) => {
    try {
        const updateResult = await noteService.updateNoteForUser(req.user._id, req.params.id, req.body, {
            runValidators: true
        });
        if (updateResult.kind === 'invalid_id') {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        if (updateResult.kind === 'validation') {
            return res.status(400).json({
                success: false,
                message: updateResult.message,
                errors: updateResult.errors
            });
        }

        if (!updateResult.ok) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to update it']
            });
        }

        res.status(200).json({
            success: true,
            message: 'Note updated successfully',
            data: updateResult.note
        });
    } catch (error) {
        handleApiError(res, error, 'Update note');
    }
};

// DELETE Operations
exports.deleteNote = async (req, res) => {
    try {
        const deleteResult = await noteService.deleteNoteForUser(req.user._id, req.params.id);
        if (deleteResult.kind === 'invalid_id') {
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID format',
                errors: ['The provided note ID is not valid']
            });
        }

        if (!deleteResult.ok) {
            return res.status(404).json({
                success: false,
                message: 'Note not found or access denied',
                errors: ['The note does not exist or you do not have permission to delete it']
            });
        }

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully',
            data: deleteResult.note
        });
    } catch (error) {
        handleApiError(res, error, 'Delete note');
    }
};
