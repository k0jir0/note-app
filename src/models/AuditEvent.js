const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['info', 'warn', 'error', 'audit'],
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 4000
    },
    category: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    source: {
        type: String,
        trim: true,
        default: 'note-app'
    },
    channel: {
        type: String,
        trim: true,
        default: ''
    },
    subjectUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    actorType: {
        type: String,
        trim: true,
        default: ''
    },
    actorEmail: {
        type: String,
        trim: true,
        default: ''
    },
    requestId: {
        type: String,
        trim: true,
        default: ''
    },
    method: {
        type: String,
        trim: true,
        default: ''
    },
    path: {
        type: String,
        trim: true,
        default: ''
    },
    statusCode: {
        type: Number,
        default: null
    },
    ip: {
        type: String,
        trim: true,
        default: ''
    },
    userAgent: {
        type: String,
        trim: true,
        default: ''
    },
    entryHash: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    previousHash: {
        type: String,
        trim: true,
        default: ''
    },
    sequence: {
        type: Number,
        default: 0
    },
    eventTimestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

auditEventSchema.index({ subjectUser: 1, eventTimestamp: -1, createdAt: -1 });
auditEventSchema.index({ subjectUser: 1, category: 1, eventTimestamp: -1 });
auditEventSchema.index({ subjectUser: 1, level: 1, eventTimestamp: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
