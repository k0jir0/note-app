const os = require('os');
const mongoose = require('mongoose');

const AuditEvent = require('../models/AuditEvent');
const { buildEntryHash, DEFAULT_SOURCE } = require('../utils/immutableLogService');

function normalizeMetadata(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.slice(0, 25).map((entry) => normalizeMetadata(entry));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .slice(0, 50)
                .map(([key, entry]) => [key, normalizeMetadata(entry)])
        );
    }

    if (typeof value === 'string') {
        return value.length > 4000 ? `${value.slice(0, 3997)}...` : value;
    }

    return value;
}

function resolveSubjectUser(metadata = {}) {
    const candidate = metadata.userId || (metadata.who && metadata.who.userId) || '';
    return mongoose.Types.ObjectId.isValid(candidate) ? new mongoose.Types.ObjectId(candidate) : null;
}

function resolveCategory(metadata = {}) {
    return String(metadata.category || '').trim();
}

function resolveChannel(metadata = {}) {
    if (metadata.channel) {
        return String(metadata.channel).trim();
    }

    if (metadata.where && metadata.where.channel) {
        return String(metadata.where.channel).trim();
    }

    return '';
}

function buildPersistedEvent({ level, message, metadata, source, host, sequence, previousHash, clock }) {
    const eventTimestamp = clock();
    const entry = {
        schemaVersion: 1,
        application: 'note-app',
        source,
        host,
        level,
        message,
        metadata,
        timestamp: eventTimestamp instanceof Date ? eventTimestamp.toISOString() : new Date(eventTimestamp).toISOString(),
        sequence,
        previousHash
    };

    return {
        entry,
        entryHash: buildEntryHash(entry),
        eventTimestamp: new Date(entry.timestamp)
    };
}

function createPersistentAuditClient({ baseClient, AuditEventModel = AuditEvent, clock = () => new Date(), osLib = os } = {}) {
    let previousHash = '';
    let sequence = 0;

    async function persist(level, message, metadata = {}) {
        const normalizedMetadata = normalizeMetadata(metadata);
        const normalizedMessage = typeof message === 'string' ? message : String(message || 'Application log event');
        const source = normalizedMetadata.source || DEFAULT_SOURCE;
        const { entry, entryHash, eventTimestamp } = buildPersistedEvent({
            level,
            message: normalizedMessage,
            metadata: normalizedMetadata,
            source,
            host: typeof osLib.hostname === 'function' ? osLib.hostname() : '',
            sequence: sequence + 1,
            previousHash,
            clock
        });

        try {
            await AuditEventModel.create({
                level,
                message: normalizedMessage,
                category: resolveCategory(normalizedMetadata),
                source,
                channel: resolveChannel(normalizedMetadata),
                subjectUser: resolveSubjectUser(normalizedMetadata),
                actorType: normalizedMetadata.who && normalizedMetadata.who.type ? String(normalizedMetadata.who.type) : '',
                actorEmail: normalizedMetadata.who && normalizedMetadata.who.email ? String(normalizedMetadata.who.email) : '',
                requestId: normalizedMetadata.requestId || (normalizedMetadata.where && normalizedMetadata.where.requestId) || '',
                method: normalizedMetadata.method || (normalizedMetadata.where && normalizedMetadata.where.method) || '',
                path: normalizedMetadata.path || (normalizedMetadata.where && normalizedMetadata.where.path) || '',
                statusCode: Number.isFinite(normalizedMetadata.statusCode) ? normalizedMetadata.statusCode : null,
                ip: normalizedMetadata.ip || (normalizedMetadata.where && normalizedMetadata.where.ip) || '',
                userAgent: normalizedMetadata.userAgent || (normalizedMetadata.where && normalizedMetadata.where.userAgent) || '',
                entryHash,
                previousHash,
                sequence: sequence + 1,
                eventTimestamp,
                metadata: entry.metadata
            });
            previousHash = entryHash;
            sequence += 1;
            return true;
        } catch (_error) {
            return false;
        }
    }

    async function capture(level, message, metadata = {}) {
        const [persisted, forwarded] = await Promise.all([
            persist(level, message, metadata),
            baseClient && baseClient.enabled && typeof baseClient.capture === 'function'
                ? baseClient.capture(level, message, metadata)
                : Promise.resolve(false)
        ]);

        return Boolean(persisted || forwarded);
    }

    return {
        enabled: true,
        capture,
        info: (message, metadata) => capture('info', message, metadata),
        warn: (message, metadata) => capture('warn', message, metadata),
        error: (message, metadata) => capture('error', message, metadata),
        audit: (message, metadata) => capture('audit', message, metadata)
    };
}

async function listAuditEventsForUser(userId, options = {}) {
    const {
        page = 1,
        limit = 10,
        level = '',
        category = '',
        AuditEventModel = AuditEvent
    } = options;
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const skip = (safePage - 1) * safeLimit;
    const query = {
        subjectUser: userId
    };

    if (typeof level === 'string' && level.trim()) {
        query.level = level.trim().toLowerCase();
    }

    if (typeof category === 'string' && category.trim()) {
        query.category = category.trim();
    }

    let eventsQuery = AuditEventModel.find(query)
        .sort({ eventTimestamp: -1, createdAt: -1 });

    if (typeof eventsQuery.lean === 'function') {
        eventsQuery = eventsQuery.lean();
    }

    if (typeof eventsQuery.skip === 'function') {
        eventsQuery = eventsQuery.skip(skip);
    }

    if (typeof eventsQuery.limit === 'function') {
        eventsQuery = eventsQuery.limit(safeLimit);
    }

    const [events, totalCount] = await Promise.all([
        eventsQuery,
        AuditEventModel.countDocuments(query)
    ]);

    return {
        events,
        totalCount,
        page: safePage,
        limit: safeLimit
    };
}

module.exports = {
    createPersistentAuditClient,
    listAuditEventsForUser
};
