const mongoose = require('mongoose');
const { applyFieldEncryption } = require('../utils/fieldEncryption');
const {
    encryptSecurityAlertDocument,
    decryptSecurityAlertDocument,
    encryptSecurityAlertUpdatePayload
} = require('../utils/sensitiveModelEncryption');

const responseActionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['notify', 'block'],
        required: true
    },
    status: {
        type: String,
        enum: ['planned', 'sent', 'skipped', 'failed'],
        default: 'planned'
    },
    provider: {
        type: String,
        trim: true,
        default: ''
    },
    detail: {
        type: String,
        trim: true,
        default: ''
    },
    target: {
        type: String,
        trim: true,
        default: ''
    },
    recordedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const responseSchema = new mongoose.Schema({
    policyVersion: {
        type: String,
        trim: true,
        default: 'ml-autonomous-v1'
    },
    level: {
        type: String,
        enum: ['none', 'notify', 'block'],
        default: 'none'
    },
    reason: {
        type: String,
        trim: true,
        default: ''
    },
    scoreAtDecision: {
        type: Number,
        min: 0,
        max: 1,
        default: null
    },
    trainedScoreUsed: {
        type: Boolean,
        default: false
    },
    target: {
        type: String,
        trim: true,
        default: ''
    },
    evaluatedAt: {
        type: Date,
        default: null
    },
    actions: {
        type: [responseActionSchema],
        default: []
    }
}, { _id: false });

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
    feedback: {
        label: {
            type: String,
            enum: ['unreviewed', 'important', 'needs_review', 'false_positive', 'resolved'],
            default: 'unreviewed'
        },
        updatedAt: {
            type: Date,
            default: null
        }
    },
    mlScore: {
        type: Number,
        min: 0,
        max: 1,
        default: null
    },
    mlLabel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: null
    },
    mlReasons: {
        type: [String],
        default: []
    },
    mlFeatures: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    scoreSource: {
        type: String,
        trim: true,
        default: 'heuristic-baseline'
    },
    response: {
        type: responseSchema,
        default: () => ({})
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

alertSchema.index({ user: 1, detectedAt: -1, createdAt: -1 });
alertSchema.index({ user: 1, source: 1, detectedAt: -1 });
alertSchema.index({ user: 1, source: 1, 'details._fingerprint': 1, detectedAt: -1 });
alertSchema.index({ user: 1, mlScore: -1, detectedAt: -1 });
alertSchema.index({ user: 1, 'feedback.label': 1, detectedAt: -1 });
alertSchema.index({ user: 1, 'response.level': 1, detectedAt: -1 });

applyFieldEncryption(alertSchema, {
    encryptDocument: encryptSecurityAlertDocument,
    decryptDocument: decryptSecurityAlertDocument,
    encryptUpdatePayload: encryptSecurityAlertUpdatePayload
});

module.exports = mongoose.model('SecurityAlert', alertSchema);
