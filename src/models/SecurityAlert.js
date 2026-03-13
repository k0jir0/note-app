const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['failed_login_burst', 'suspicious_path_probe', 'high_error_rate', 'scanner_tool_detected', 'injection_attempt', 'directory_enumeration']
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high']
    },
    summary: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    source: {
        type: String,
        trim: true,
        default: 'manual-log-input'
    },
    detectedAt: {
        type: Date,
        default: Date.now
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SecurityAlert', alertSchema);
