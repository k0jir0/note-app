const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { EJSON } = require('bson');

const Note = require('../models/Notes');
const User = require('../models/User');
const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const AuditEvent = require('../models/AuditEvent');
const AuditChainState = require('../models/AuditChainState');
const BreakGlassState = require('../models/BreakGlassState');

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_APPLICATION_ID = 'note-app';

function listContinuityCollectionDefinitions(models = {}) {
    return [
        { id: 'users', label: 'Users', Model: models.User || User },
        { id: 'notes', label: 'Notes', Model: models.Note || Note },
        { id: 'securityAlerts', label: 'Security Alerts', Model: models.SecurityAlert || SecurityAlert },
        { id: 'scanResults', label: 'Scan Results', Model: models.ScanResult || ScanResult },
        { id: 'auditEvents', label: 'Audit Events', Model: models.AuditEvent || AuditEvent },
        { id: 'auditChainStates', label: 'Audit Chain States', Model: models.AuditChainState || AuditChainState },
        { id: 'breakGlassStates', label: 'Break Glass States', Model: models.BreakGlassState || BreakGlassState }
    ];
}

async function exportBackupArchive({ collectionDefinitions = listContinuityCollectionDefinitions(), metadata = {} } = {}) {
    const collections = {};
    const summary = [];

    for (const definition of collectionDefinitions) {
        const documents = await definition.Model.collection
            .find({})
            .sort({ _id: 1 })
            .toArray();

        collections[definition.id] = documents;
        summary.push({
            id: definition.id,
            label: definition.label,
            count: documents.length
        });
    }

    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        application: BACKUP_APPLICATION_ID,
        generatedAt: new Date().toISOString(),
        metadata: {
            nodeEnv: String(metadata.nodeEnv || process.env.NODE_ENV || ''),
            reason: String(metadata.reason || '').trim()
        },
        summary,
        collections
    };
}

function validateParsedArchive(archive) {
    if (!archive || typeof archive !== 'object') {
        throw new Error('Backup archive payload is invalid.');
    }

    if (archive.application !== BACKUP_APPLICATION_ID) {
        throw new Error(`Backup archive application must be ${BACKUP_APPLICATION_ID}.`);
    }

    if (archive.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        throw new Error(`Backup archive schemaVersion must be ${BACKUP_SCHEMA_VERSION}.`);
    }

    if (!archive.collections || typeof archive.collections !== 'object') {
        throw new Error('Backup archive collections payload is missing.');
    }

    return archive;
}

function serializeBackupArchive(archive) {
    return EJSON.stringify(validateParsedArchive(archive), null, 2);
}

function parseBackupArchivePayload(rawPayload) {
    return validateParsedArchive(EJSON.parse(String(rawPayload || '')));
}

function isGzipBuffer(buffer) {
    return Buffer.isBuffer(buffer)
        && buffer.length >= 2
        && buffer[0] === 0x1f
        && buffer[1] === 0x8b;
}

function encodeBackupArchive(archive, { gzip = true } = {}) {
    const serializedArchive = Buffer.from(serializeBackupArchive(archive), 'utf8');
    return gzip ? zlib.gzipSync(serializedArchive) : serializedArchive;
}

function decodeBackupArchive(buffer) {
    const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const rawPayload = isGzipBuffer(normalizedBuffer)
        ? zlib.gunzipSync(normalizedBuffer).toString('utf8')
        : normalizedBuffer.toString('utf8');

    return parseBackupArchivePayload(rawPayload);
}

function ensureBackupDirectory(filePath, fsLib = fs) {
    fsLib.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeBackupArchive(filePath, archive, { gzip = true, fsLib = fs } = {}) {
    ensureBackupDirectory(filePath, fsLib);
    fsLib.writeFileSync(filePath, encodeBackupArchive(archive, { gzip }));
    return filePath;
}

function readBackupArchive(filePath, { fsLib = fs } = {}) {
    return decodeBackupArchive(fsLib.readFileSync(filePath));
}

async function restoreBackupArchive({
    backupArchive,
    collectionDefinitions = listContinuityCollectionDefinitions(),
    dryRun = false,
    clearExisting = true
} = {}) {
    const archive = validateParsedArchive(backupArchive);
    const summary = [];

    for (const definition of collectionDefinitions) {
        const documents = Array.isArray(archive.collections[definition.id])
            ? archive.collections[definition.id]
            : [];

        if (!dryRun) {
            if (clearExisting) {
                await definition.Model.collection.deleteMany({});
            }

            if (documents.length > 0) {
                await definition.Model.collection.insertMany(documents, { ordered: true });
            }
        }

        summary.push({
            id: definition.id,
            label: definition.label,
            restoredCount: documents.length
        });
    }

    return summary;
}

async function collectReconstitutionStatus({
    collectionDefinitions = listContinuityCollectionDefinitions(),
    runtimeConfig = {},
    requireUsers = false
} = {}) {
    const collectionCounts = {};
    const issues = [];
    const warnings = [];

    for (const definition of collectionDefinitions) {
        try {
            collectionCounts[definition.id] = await definition.Model.collection.countDocuments({});
        } catch (error) {
            const detail = error && error.message ? error.message : String(error);
            issues.push(`Unable to read ${definition.label}: ${detail}`);
        }
    }

    if (!issues.length) {
        const userCount = collectionCounts.users || 0;
        if (requireUsers && userCount < 1) {
            issues.push('No user records are present. Restore or provision at least one account before accepting traffic.');
        } else if (userCount < 1) {
            warnings.push('No user records are present yet.');
        }

        if ((collectionCounts.auditChainStates || 0) > 1) {
            issues.push('Audit chain state contains more than one record. Review backup consistency before accepting traffic.');
        }

        if ((collectionCounts.breakGlassStates || 0) > 1) {
            issues.push('Break-glass state contains more than one record. Review backup consistency before accepting traffic.');
        }
    }

    return {
        checkedAt: new Date().toISOString(),
        ready: issues.length === 0,
        runtime: {
            protectedRuntime: Boolean(runtimeConfig.identityLifecycle && runtimeConfig.identityLifecycle.protectedRuntime),
            secureTransportRequired: Boolean(runtimeConfig.transport && runtimeConfig.transport.secureTransportRequired),
            immutableLoggingRequired: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.required)
        },
        collectionCounts,
        issues,
        warnings
    };
}

module.exports = {
    BACKUP_APPLICATION_ID,
    BACKUP_SCHEMA_VERSION,
    collectReconstitutionStatus,
    decodeBackupArchive,
    encodeBackupArchive,
    exportBackupArchive,
    listContinuityCollectionDefinitions,
    parseBackupArchivePayload,
    readBackupArchive,
    restoreBackupArchive,
    serializeBackupArchive,
    writeBackupArchive
};
