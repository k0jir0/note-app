const mongoose = require('mongoose');
const { VALIDATION_LIMITS } = require('../utils/validation');

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
        default: '',
        maxlength: VALIDATION_LIMITS.NOTE_CONTENT_MAX
    },
    image: {
        type: String,
        default: '',
        maxlength: VALIDATION_LIMITS.NOTE_IMAGE_URL_MAX
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

module.exports = mongoose.model('Note', noteSchema);
