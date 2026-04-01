const mongoose = require('mongoose');

const Notes = require('../models/Notes');
const { buildCreateNoteData, buildUpdateNoteData } = require('../utils/noteMutations');
const noteImageAssetService = require('./noteImageAssetService');

const NOTE_LIST_SELECT = 'title content image imageAssetKey imageAssetContentType createdAt updatedAt';
const INVALID_NOTE_ID_MESSAGE = 'Invalid note ID';
const NOTE_NOT_FOUND_MESSAGE = 'Note not found or access denied';

function normalizeNoteId(rawId) {
    return typeof rawId === 'string' ? rawId.trim() : '';
}

function isValidNoteId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function buildNoteIdResult(rawId) {
    const id = normalizeNoteId(rawId);
    if (!isValidNoteId(id)) {
        return {
            ok: false,
            kind: 'invalid_id',
            id,
            message: INVALID_NOTE_ID_MESSAGE
        };
    }

    return {
        ok: true,
        id
    };
}

async function listNotesForUser(userId, options = {}) {
    const {
        skip = null,
        limit = null
    } = options;

    let query = Notes.find({ user: userId })
        .select(NOTE_LIST_SELECT)
        .sort({ updatedAt: -1 });

    if (Number.isInteger(skip) && skip > 0 && typeof query.skip === 'function') {
        query = query.skip(skip);
    }

    if (Number.isInteger(limit) && limit > 0 && typeof query.limit === 'function') {
        query = query.limit(limit);
    }

    return query;
}

async function countNotesForUser(userId) {
    return Notes.countDocuments({ user: userId });
}

async function getNoteForUser(userId, rawId) {
    const idResult = buildNoteIdResult(rawId);
    if (!idResult.ok) {
        return idResult;
    }

    const note = await Notes.findOne({ _id: idResult.id, user: userId });
    if (!note) {
        return {
            ok: false,
            kind: 'not_found',
            id: idResult.id,
            message: NOTE_NOT_FOUND_MESSAGE
        };
    }

    return {
        ok: true,
        id: idResult.id,
        note
    };
}

function buildImageValidationResult(baseResult, error) {
    const message = error && error.message
        ? String(error.message)
        : 'Unable to download and store the note image.';

    return {
        ok: false,
        kind: 'validation',
        message: 'Validation failed',
        errors: [message],
        inputData: baseResult.inputData,
        sanitizedData: baseResult.sanitizedData,
        fieldErrors: {
            ...baseResult.fieldErrors,
            image: message
        }
    };
}

async function ensureNoteImageAssetForUser(userId, rawId) {
    const noteResult = await getNoteForUser(userId, rawId);
    if (!noteResult.ok) {
        return noteResult;
    }

    const existingNote = noteResult.note;
    if (!existingNote.image || existingNote.imageAssetKey) {
        return noteResult;
    }

    try {
        const asset = await noteImageAssetService.persistRemoteNoteImage({
            noteId: existingNote._id,
            sourceUrl: existingNote.image
        });

        const note = await Notes.findOneAndUpdate(
            { _id: existingNote._id, user: userId },
            {
                imageAssetKey: asset.assetKey,
                imageAssetContentType: asset.contentType
            },
            { new: true }
        );

        return {
            ok: true,
            id: noteResult.id,
            note: note || existingNote
        };
    } catch (_error) {
        return {
            ok: false,
            kind: 'image_unavailable',
            id: noteResult.id,
            message: 'Note image is unavailable.'
        };
    }
}

async function createNoteForUser(payload, userId) {
    const noteResult = buildCreateNoteData(payload, userId);
    if (!noteResult.isValid) {
        return {
            ok: false,
            kind: 'validation',
            ...noteResult
        };
    }

    const note = await Notes.create({
        ...noteResult.data,
        imageAssetKey: '',
        imageAssetContentType: ''
    });

    if (!noteResult.data.image) {
        return {
            ok: true,
            note
        };
    }

    try {
        const asset = await noteImageAssetService.persistRemoteNoteImage({
            noteId: note._id,
            sourceUrl: noteResult.data.image
        });

        const updatedNote = await Notes.findOneAndUpdate(
            { _id: note._id, user: userId },
            {
                imageAssetKey: asset.assetKey,
                imageAssetContentType: asset.contentType
            },
            { new: true }
        );

        return {
            ok: true,
            note: updatedNote || note
        };
    } catch (error) {
        await Notes.findOneAndDelete({ _id: note._id, user: userId }).catch(() => null);
        return buildImageValidationResult(noteResult, error);
    }
}

async function updateNoteForUser(userId, rawId, payload, options = {}) {
    const idResult = buildNoteIdResult(rawId);
    if (!idResult.ok) {
        return idResult;
    }

    const existingNoteResult = await getNoteForUser(userId, rawId);
    if (!existingNoteResult.ok) {
        return existingNoteResult;
    }

    const existingNote = existingNoteResult.note;

    const updateResult = buildUpdateNoteData(payload);
    if (!updateResult.isValid) {
        return {
            ok: false,
            kind: 'validation',
            id: idResult.id,
            ...updateResult
        };
    }

    const queryOptions = { new: true };
    if (options.runValidators) {
        queryOptions.runValidators = true;
    }

    let oldAssetToDelete = '';
    const updatesImage = Object.prototype.hasOwnProperty.call(updateResult.data, 'image');
    if (updatesImage) {
        const nextImageSource = updateResult.data.image || '';

        if (!nextImageSource) {
            updateResult.data.imageAssetKey = '';
            updateResult.data.imageAssetContentType = '';
            oldAssetToDelete = existingNote.imageAssetKey || '';
        } else if (nextImageSource === existingNote.image && existingNote.imageAssetKey) {
            updateResult.data.imageAssetKey = existingNote.imageAssetKey;
            updateResult.data.imageAssetContentType = existingNote.imageAssetContentType || '';
        } else {
            try {
                const asset = await noteImageAssetService.persistRemoteNoteImage({
                    noteId: idResult.id,
                    sourceUrl: nextImageSource
                });

                updateResult.data.imageAssetKey = asset.assetKey;
                updateResult.data.imageAssetContentType = asset.contentType;
                oldAssetToDelete = existingNote.imageAssetKey || '';
            } catch (error) {
                return buildImageValidationResult(updateResult, error);
            }
        }
    }

    const note = await Notes.findOneAndUpdate(
        { _id: idResult.id, user: userId },
        updateResult.data,
        queryOptions
    );

    if (!note) {
        return {
            ok: false,
            kind: 'not_found',
            id: idResult.id,
            message: NOTE_NOT_FOUND_MESSAGE
        };
    }

    if (oldAssetToDelete && oldAssetToDelete !== note.imageAssetKey) {
        await noteImageAssetService.deleteNoteImageAsset({ imageAssetKey: oldAssetToDelete }).catch(() => false);
    }

    return {
        ok: true,
        id: idResult.id,
        note
    };
}

async function deleteNoteForUser(userId, rawId) {
    const idResult = buildNoteIdResult(rawId);
    if (!idResult.ok) {
        return idResult;
    }

    const note = await Notes.findOneAndDelete({ _id: idResult.id, user: userId });
    if (!note) {
        return {
            ok: false,
            kind: 'not_found',
            id: idResult.id,
            message: NOTE_NOT_FOUND_MESSAGE
        };
    }

    await noteImageAssetService.deleteNoteImageAsset(note).catch(() => false);

    return {
        ok: true,
        id: idResult.id,
        note
    };
}

module.exports = {
    INVALID_NOTE_ID_MESSAGE,
    NOTE_NOT_FOUND_MESSAGE,
    buildNoteIdResult,
    countNotesForUser,
    createNoteForUser,
    deleteNoteForUser,
    ensureNoteImageAssetForUser,
    getNoteForUser,
    listNotesForUser,
    updateNoteForUser
};
