const mongoose = require('mongoose');
const { applyFieldEncryption } = require('../utils/fieldEncryption');
const { applyDatabaseTelemetry } = require('../utils/databaseTelemetry');
const {
    encryptUserDocument,
    decryptUserDocument,
    encryptUserUpdatePayload
} = require('../utils/sensitiveModelEncryption');

const MISSION_ROLES = [
    'external',
    'operator',
    'analyst',
    'mission_lead',
    'auditor',
    'admin',
    'break_glass'
];

const CLEARANCE_LEVELS = [
    'unclassified',
    'protected_a',
    'protected_b',
    'secret',
    'top_secret'
];

const DEVICE_TIERS = [
    'unknown',
    'managed',
    'hardened'
];

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: false,
        minLength: [8, 'Password must be at least 8 characters long']
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    name: {
        type: String
    },
    accessProfile: {
        missionRole: {
            type: String,
            enum: MISSION_ROLES,
            default: 'analyst'
        },
        clearance: {
            type: String,
            enum: CLEARANCE_LEVELS,
            default: 'protected_b'
        },
        unit: {
            type: String,
            default: 'cyber-task-force'
        },
        assignedMissions: {
            type: [String],
            default: () => ['research-workspace', 'browser-assurance']
        },
        deviceTier: {
            type: String,
            enum: DEVICE_TIERS,
            default: 'managed'
        },
        networkZones: {
            type: [String],
            default: () => ['corp']
        },
        mfaVerifiedAt: {
            type: Date,
            default: null
        },
        registeredHardwareToken: {
            type: Boolean,
            default: false
        },
        hardwareTokenLabel: {
            type: String,
            default: ''
        },
        hardwareTokenSerial: {
            type: String,
            default: ''
        },
        webauthnCredentials: {
            type: [{
                credentialId: {
                    type: String,
                    required: true
                },
                publicKey: {
                    type: String,
                    required: true
                },
                counter: {
                    type: Number,
                    default: 0
                },
                transports: {
                    type: [String],
                    default: []
                },
                label: {
                    type: String,
                    default: 'Registered security key'
                },
                algorithm: {
                    type: Number,
                    default: null
                },
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }],
            default: []
        },
        registeredPkiCertificate: {
            type: Boolean,
            default: false
        },
        pkiCertificateSubject: {
            type: String,
            default: ''
        },
        pkiCertificateIssuer: {
            type: String,
            default: ''
        },
        breakGlassApproved: {
            type: Boolean,
            default: false
        },
        breakGlassReason: {
            type: String,
            default: ''
        }
    },
    sessionControl: {
        activeSessionId: {
            type: String,
            default: ''
        },
        activeSessionIssuedAt: {
            type: Date,
            default: null
        },
        lastLockReason: {
            type: String,
            default: ''
        },
        lastLockAt: {
            type: Date,
            default: null
        }
    },
    authenticationState: {
        failedLoginAttempts: {
            type: Number,
            default: 0
        },
        lastFailedLoginAt: {
            type: Date,
            default: null
        },
        lastFailedLoginIp: {
            type: String,
            default: ''
        },
        lockoutUntil: {
            type: Date,
            default: null
        },
        lastSuccessfulLoginAt: {
            type: Date,
            default: null
        }
    },
    preferences: {
        nightMode: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

applyFieldEncryption(userSchema, {
    encryptDocument: encryptUserDocument,
    decryptDocument: decryptUserDocument,
    encryptUpdatePayload: encryptUserUpdatePayload
});

applyDatabaseTelemetry(userSchema, { modelName: 'User' });

module.exports = mongoose.model('User', userSchema);
