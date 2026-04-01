const mongoose = require('mongoose');

const breakGlassStateSchema = new mongoose.Schema({
    controlKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        default: 'default'
    },
    mode: {
        type: String,
        enum: ['disabled', 'read_only', 'offline'],
        default: 'disabled'
    },
    reason: {
        type: String,
        trim: true,
        default: ''
    },
    activatedAt: {
        type: Date,
        default: null
    },
    activatedBy: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BreakGlassState', breakGlassStateSchema);
