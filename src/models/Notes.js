const mongoose = require('mongoose');
const { VALIDATION_LIMITS } = require('../utils/validation');
const { applyDatabaseTelemetry } = require('../utils/databaseTelemetry');
const {
    ENCRYPTED_NOTE_FIELDS,
    encryptText,
    encryptNoteUpdatePayload,
    decryptNoteDocumentFields
} = require('../utils/noteEncryption');

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: VALIDATION_LIMITS.NOTE_TITLE_MIN,
        maxlength: VALIDATION_LIMITS.NOTE_TITLE_MAX
    },
    content: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    imageAssetKey: {
        type: String,
        default: ''
    },
    imageAssetContentType: {
        type: String,
        default: ''
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true  // Automatically adds createdAt & updatedAt
});

noteSchema.index({ user: 1, updatedAt: -1 });

function runNoteHook(next, operation) {
    try {
        operation();
    } catch (error) {
        if (typeof next === 'function') {
            next(error);
            return;
        }

        throw error;
    }

    if (typeof next === 'function') {
        next();
    }
}

noteSchema.pre('save', function encryptNoteFields(next) {
    return runNoteHook(next, () => {
        ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => {
            if (!this.isModified(fieldName)) {
                return;
            }

            const value = this.get(fieldName);
            if (typeof value === 'string') {
                this.set(fieldName, encryptText(value));
            }
        });
    });
});

noteSchema.pre('findOneAndUpdate', function encryptUpdatedNoteFields(next) {
    return runNoteHook(next, () => {
        const update = this.getUpdate();
        this.setUpdate(encryptNoteUpdatePayload(update));
    });
});

noteSchema.post('init', function decryptNoteAfterInit(document) {
    decryptNoteDocumentFields(document);
});

noteSchema.post('save', function decryptNoteAfterSave(document, next) {
    return runNoteHook(next, () => {
        decryptNoteDocumentFields(document);
    });
});

noteSchema.post('find', function decryptNotesAfterFind(documents) {
    if (!Array.isArray(documents)) {
        return;
    }

    documents.forEach((document) => {
        decryptNoteDocumentFields(document);
    });
});

noteSchema.post('findOne', function decryptNoteAfterFindOne(document) {
    decryptNoteDocumentFields(document);
});

noteSchema.post('findOneAndUpdate', function decryptNoteAfterFindOneAndUpdate(document) {
    decryptNoteDocumentFields(document);
});

applyDatabaseTelemetry(noteSchema, { modelName: 'Note' });

module.exports = mongoose.model('Note', noteSchema);
