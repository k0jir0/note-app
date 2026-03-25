const mongoose = require('mongoose');

const Notes = require('../models/Notes');
const { buildCreateNoteData, buildUpdateNoteData } = require('../utils/noteMutations');

const NOTE_LIST_SELECT = 'title content image createdAt updatedAt';
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

async function createNoteForUser(payload, userId) {
    const noteResult = buildCreateNoteData(payload, userId);
    if (!noteResult.isValid) {
        return {
            ok: false,
            kind: 'validation',
            ...noteResult
        };
    }

    const note = await Notes.create(noteResult.data);
    return {
        ok: true,
        note
    };
}

async function updateNoteForUser(userId, rawId, payload, options = {}) {
    const idResult = buildNoteIdResult(rawId);
    if (!idResult.ok) {
        return idResult;
    }

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
    getNoteForUser,
    listNotesForUser,
    updateNoteForUser
};
