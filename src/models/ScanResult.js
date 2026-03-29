const mongoose = require('mongoose');
const { applyFieldEncryption } = require('../utils/fieldEncryption');
const {
    encryptScanResultDocument,
    decryptScanResultDocument,
    encryptScanResultUpdatePayload
} = require('../utils/sensitiveModelEncryption');

const findingSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['open_port', 'vulnerability', 'misconfiguration', 'info']
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'info']
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const scanResultSchema = new mongoose.Schema({
    target: {
        type: String,
        trim: true,
        default: 'unknown'
    },
    tool: {
        type: String,
        required: true,
        enum: ['nmap', 'nikto', 'json', 'text']
    },
    findings: [findingSchema],
    summary: {
        type: String,
        trim: true,
        maxlength: 500
    },
    source: {
        type: String,
        trim: true,
        default: 'manual-scan-input'
    },
    fingerprint: {
        type: String,
        trim: true,
        index: true,
        sparse: true
    },
    importedAt: {
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

scanResultSchema.index({ user: 1, importedAt: -1, createdAt: -1 });
scanResultSchema.index({ user: 1, source: 1, fingerprint: 1, importedAt: -1 });

applyFieldEncryption(scanResultSchema, {
    encryptDocument: encryptScanResultDocument,
    decryptDocument: decryptScanResultDocument,
    encryptUpdatePayload: encryptScanResultUpdatePayload
});

module.exports = mongoose.model('ScanResult', scanResultSchema);
