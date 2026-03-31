const mongoose = require('mongoose');

const auditChainStateSchema = new mongoose.Schema({
    chainKey: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    sequence: {
        type: Number,
        default: 0
    },
    lastHash: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AuditChainState', auditChainStateSchema);
