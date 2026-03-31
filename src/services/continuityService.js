const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { EJSON } = require('bson');
const {
    buildEncryptedPayload,
    decryptEncryptedPayload,
    getCryptoSuite,
    isEncryptedPayload
} = require('../utils/cryptoSuite');

const Note = require('../models/Notes');
const User = require('../models/User');
const SecurityAlert = require('../models/SecurityAlert');
const ScanResult = require('../models/ScanResult');
const AuditEvent = require('../models/AuditEvent');
const AuditChainState = require('../models/AuditChainState');
const BreakGlassState = require('../models/BreakGlassState');

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_APPLICATION_ID = 'note-app';
const BACKUP_ENVELOPE_SCHEMA_VERSION = 1;
const BACKUP_ENVELOPE_APPLICATION_ID = 'note-app-backup-envelope';
const BACKUP_PROTECTION_CONTEXT = 'note-app-backup-protection-v1';

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

function buildProtectionKey(protection = {}) {
    const rawSecret = String(protection.rawSecret || protection.secret || '').trim();
    if (!rawSecret) {
        return null;
    }

    const suite = getCryptoSuite(protection.cipherAlgo);
    const expectedHexLength = suite.keyLengthBytes * 2;
    let baseKey = null;

    if (new RegExp(`^[a-fA-F0-9]{${expectedHexLength}}$`).test(rawSecret)) {
        baseKey = Buffer.from(rawSecret, 'hex');
    } else {
        const decoded = Buffer.from(rawSecret, 'base64');
        if (decoded.length === suite.keyLengthBytes) {
            baseKey = decoded;
        }
    }

    if (!baseKey || baseKey.length !== suite.keyLengthBytes) {
        throw new Error(`Backup archive protection secret must be a ${expectedHexLength}-character hex string or base64 for ${suite.keyLengthBytes} bytes`);
    }

    const derivedKey = typeof crypto.hkdfSync === 'function'
        ? crypto.hkdfSync(
            'sha256',
            baseKey,
            Buffer.from(BACKUP_APPLICATION_ID, 'utf8'),
            Buffer.from(BACKUP_PROTECTION_CONTEXT, 'utf8'),
            suite.keyLengthBytes
        )
        : crypto.createHash('sha256')
            .update(baseKey)
            .update(BACKUP_APPLICATION_ID)
            .update(BACKUP_PROTECTION_CONTEXT)
            .digest()
            .subarray(0, suite.keyLengthBytes);

    return {
        suite,
        key: Buffer.from(derivedKey)
    };
}

function isGzipBuffer(buffer) {
    return Buffer.isBuffer(buffer)
        && buffer.length >= 2
        && buffer[0] === 0x1f
        && buffer[1] === 0x8b;
}

function encodeBackupArchive(archive, { gzip = true, protection = null } = {}) {
    const resolvedProtection = buildProtectionKey(protection);
    if (!resolvedProtection) {
        throw new Error('Backup archive protection secret is required to encode backup archives.');
    }

    const serializedArchive = Buffer.from(serializeBackupArchive(archive), 'utf8');
    const archivePayload = gzip ? zlib.gzipSync(serializedArchive) : serializedArchive;
    const encryptedPayload = buildEncryptedPayload({
        suite: resolvedProtection.suite,
        plaintext: archivePayload.toString('base64'),
        key: resolvedProtection.key
    });

    return Buffer.from(JSON.stringify({
        schemaVersion: BACKUP_ENVELOPE_SCHEMA_VERSION,
        application: BACKUP_ENVELOPE_APPLICATION_ID,
        archiveApplication: BACKUP_APPLICATION_ID,
        generatedAt: new Date().toISOString(),
        cipherAlgo: resolvedProtection.suite.id,
        compression: gzip ? 'gzip' : 'none',
        payload: encryptedPayload
    }, null, 2), 'utf8');
}

function decodeBackupArchive(buffer, { protection = null, allowPlaintextArchive = false } = {}) {
    const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const rawPayload = isGzipBuffer(normalizedBuffer)
        ? zlib.gunzipSync(normalizedBuffer).toString('utf8')
        : normalizedBuffer.toString('utf8');

    const parsedPayload = EJSON.parse(String(rawPayload || ''));
    if (parsedPayload && parsedPayload.application === BACKUP_ENVELOPE_APPLICATION_ID) {
        const resolvedProtection = buildProtectionKey({
            rawSecret: protection && protection.rawSecret ? protection.rawSecret : protection && protection.secret,
            cipherAlgo: parsedPayload.cipherAlgo || (protection && protection.cipherAlgo)
        });
        if (!resolvedProtection) {
            throw new Error('Backup archive protection secret is required to read protected backup archives.');
        }

        if (!isEncryptedPayload(parsedPayload.payload)) {
            throw new Error('Protected backup archive payload is invalid.');
        }

        const decryptedPayload = decryptEncryptedPayload(parsedPayload.payload, resolvedProtection.key);
        const archiveBuffer = Buffer.from(decryptedPayload, 'base64');
        const serializedArchive = parsedPayload.compression === 'gzip'
            ? zlib.gunzipSync(archiveBuffer).toString('utf8')
            : archiveBuffer.toString('utf8');

        return parseBackupArchivePayload(serializedArchive);
    }

    if (!allowPlaintextArchive) {
        throw new Error('Plaintext backup archives are not accepted by default. Re-export the archive or opt in explicitly.');
    }

    return validateParsedArchive(parsedPayload);
}

function ensureBackupDirectory(filePath, fsLib = fs) {
    fsLib.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeBackupArchive(filePath, archive, { gzip = true, protection = null, fsLib = fs } = {}) {
    ensureBackupDirectory(filePath, fsLib);
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fsLib.writeFileSync(tempPath, encodeBackupArchive(archive, { gzip, protection }));
    fsLib.renameSync(tempPath, filePath);
    return filePath;
}

function readBackupArchive(filePath, { fsLib = fs, protection = null, allowPlaintextArchive = false } = {}) {
    return decodeBackupArchive(fsLib.readFileSync(filePath), {
        protection,
        allowPlaintextArchive
    });
}

async function applyRestoreArchive({
    backupArchive,
    collectionDefinitions = listContinuityCollectionDefinitions(),
    clearExisting = true,
    session = null
} = {}) {
    const archive = validateParsedArchive(backupArchive);
    const summary = [];

    for (const definition of collectionDefinitions) {
        const documents = Array.isArray(archive.collections[definition.id])
            ? archive.collections[definition.id]
            : [];

        if (clearExisting) {
            await definition.Model.collection.deleteMany({}, session ? { session } : undefined);
        }

        if (documents.length > 0) {
            await definition.Model.collection.insertMany(documents, session ? {
                ordered: true,
                session
            } : {
                ordered: true
            });
        }

        summary.push({
            id: definition.id,
            label: definition.label,
            restoredCount: documents.length
        });
    }

    return summary;
}

async function runRestoreTransaction(mongooseConnection, handler) {
    if (!mongooseConnection || typeof mongooseConnection.startSession !== 'function') {
        throw new Error('Transactional restore requires a Mongoose connection with session support.');
    }

    const session = await mongooseConnection.startSession();
    try {
        if (typeof session.withTransaction !== 'function') {
            throw new Error('Transactional restore requires MongoDB transaction support.');
        }

        let result = null;
        await session.withTransaction(async () => {
            result = await handler(session);
        });
        return result;
    } finally {
        if (typeof session.endSession === 'function') {
            await session.endSession();
        }
    }
}

async function restoreBackupArchive({
    backupArchive,
    collectionDefinitions = listContinuityCollectionDefinitions(),
    dryRun = false,
    clearExisting = true,
    mongooseConnection = null,
    allowNonTransactionalRestore = false
} = {}) {
    if (dryRun) {
        return applyRestoreArchive({
            backupArchive,
            collectionDefinitions,
            clearExisting,
            session: null
        });
    }

    if (mongooseConnection) {
        return runRestoreTransaction(mongooseConnection, (session) => applyRestoreArchive({
            backupArchive,
            collectionDefinitions,
            clearExisting,
            session
        }));
    }

    if (!allowNonTransactionalRestore) {
        throw new Error('Transactional restore support is required before applying a destructive restore.');
    }

    return applyRestoreArchive({
        backupArchive,
        collectionDefinitions,
        clearExisting,
        session: null
    });
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
    BACKUP_ENVELOPE_APPLICATION_ID,
    BACKUP_ENVELOPE_SCHEMA_VERSION,
    BACKUP_SCHEMA_VERSION,
    buildProtectionKey,
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
