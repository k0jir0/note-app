const mongoose = require('mongoose');

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

module.exports = mongoose.model('ScanResult', scanResultSchema);
