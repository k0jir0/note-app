const os = require('os');
const mongoose = require('mongoose');

const AuditEvent = require('../models/AuditEvent');
const AuditChainState = require('../models/AuditChainState');
const { buildEntryHash, DEFAULT_SOURCE } = require('../utils/immutableLogService');
const { enrichMetadataWithRequestContext } = require('../utils/semanticLogging');

const DEFAULT_CHAIN_KEY = 'default';
const MAX_CHAIN_RESERVATION_ATTEMPTS = 5;

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

async function ensureChainStateDocument(AuditChainStateModel, chainKey = DEFAULT_CHAIN_KEY) {
    if (!AuditChainStateModel || typeof AuditChainStateModel.findOneAndUpdate !== 'function') {
        return {
            chainKey,
            sequence: 0,
            lastHash: ''
        };
    }

    let query = AuditChainStateModel.findOneAndUpdate(
        { chainKey },
        {
            $setOnInsert: {
                chainKey,
                sequence: 0,
                lastHash: ''
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );

    if (typeof query.lean === 'function') {
        query = query.lean();
    }

    return query;
}

async function readChainState(AuditChainStateModel, chainKey = DEFAULT_CHAIN_KEY) {
    if (!AuditChainStateModel || typeof AuditChainStateModel.findOne !== 'function') {
        return {
            chainKey,
            sequence: 0,
            lastHash: ''
        };
    }

    let query = AuditChainStateModel.findOne({ chainKey });
    if (query && typeof query.lean === 'function') {
        query = query.lean();
    }

    return query;
}

async function reserveChainPosition({
    AuditChainStateModel,
    level,
    message,
    metadata,
    source,
    host,
    clock,
    chainKey = DEFAULT_CHAIN_KEY
}) {
    await ensureChainStateDocument(AuditChainStateModel, chainKey);

    for (let attempt = 0; attempt < MAX_CHAIN_RESERVATION_ATTEMPTS; attempt += 1) {
        const currentState = await readChainState(AuditChainStateModel, chainKey) || {
            chainKey,
            sequence: 0,
            lastHash: ''
        };
        const currentSequence = Number.isFinite(Number(currentState.sequence))
            ? Number(currentState.sequence)
            : 0;
        const previousHash = String(currentState.lastHash || '').trim();
        const { entry, entryHash, eventTimestamp } = buildPersistedEvent({
            level,
            message,
            metadata,
            source,
            host,
            sequence: currentSequence + 1,
            previousHash,
            clock
        });

        if (!AuditChainStateModel || typeof AuditChainStateModel.findOneAndUpdate !== 'function') {
            return {
                entry,
                entryHash,
                eventTimestamp,
                sequence: currentSequence + 1,
                previousHash,
                chainKey
            };
        }

        let updateAttempt = AuditChainStateModel.findOneAndUpdate(
            {
                chainKey,
                sequence: currentSequence,
                lastHash: previousHash
            },
            {
                $set: {
                    sequence: currentSequence + 1,
                    lastHash: entryHash
                }
            },
            {
                new: true
            }
        );

        if (updateAttempt && typeof updateAttempt.lean === 'function') {
            updateAttempt = updateAttempt.lean();
        }

        const updatedState = await updateAttempt;
        if (updatedState) {
            return {
                entry,
                entryHash,
                eventTimestamp,
                sequence: currentSequence + 1,
                previousHash,
                chainKey
            };
        }
    }

    throw new Error('Unable to reserve the next audit-chain position.');
}

async function rollbackChainReservation(AuditChainStateModel, reservedPosition) {
    if (!AuditChainStateModel || typeof AuditChainStateModel.updateOne !== 'function' || !reservedPosition) {
        return;
    }

    await AuditChainStateModel.updateOne(
        {
            chainKey: reservedPosition.chainKey || DEFAULT_CHAIN_KEY,
            sequence: reservedPosition.sequence,
            lastHash: reservedPosition.entryHash
        },
        {
            $set: {
                sequence: Math.max(0, reservedPosition.sequence - 1),
                lastHash: reservedPosition.previousHash || ''
            }
        }
    ).catch(() => null);
}

function createPersistentAuditClient({
    baseClient,
    AuditEventModel = AuditEvent,
    AuditChainStateModel = AuditChainState,
    requireRemoteSuccess = false,
    throwOnRequiredFailure = false,
    onRequiredFailure = null,
    clock = () => new Date(),
    osLib = os
} = {}) {
    const hasRemoteForwarder = Boolean(baseClient && baseClient.enabled && typeof baseClient.capture === 'function');
    const deliveryState = {
        healthy: true,
        degraded: false,
        persistedHealthy: true,
        remoteHealthy: true,
        requireRemoteSuccess: Boolean(requireRemoteSuccess),
        lastAttemptAt: '',
        lastSuccessAt: '',
        lastFailureAt: '',
        lastError: '',
        lastOutcome: {
            persisted: null,
            forwarded: hasRemoteForwarder ? null : true
        }
    };

    function toIsoTimestamp(value) {
        if (value instanceof Date) {
            return value.toISOString();
        }

        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }

    function updateDeliveryState({ persisted, forwarded, error = null, occurredAt = clock() } = {}) {
        const attemptTimestamp = toIsoTimestamp(occurredAt);
        const persistedHealthy = Boolean(persisted);
        const remoteHealthy = hasRemoteForwarder ? Boolean(forwarded) : true;
        const healthy = persistedHealthy && remoteHealthy;

        deliveryState.persistedHealthy = persistedHealthy;
        deliveryState.remoteHealthy = remoteHealthy;
        deliveryState.healthy = healthy;
        deliveryState.degraded = !healthy;
        deliveryState.lastAttemptAt = attemptTimestamp;
        deliveryState.lastOutcome = {
            persisted: persistedHealthy,
            forwarded: remoteHealthy
        };

        if (healthy) {
            deliveryState.lastSuccessAt = attemptTimestamp;
            deliveryState.lastError = '';
            return;
        }

        deliveryState.lastFailureAt = attemptTimestamp;
        deliveryState.lastError = error && error.message
            ? error.message
            : 'Immutable audit delivery degraded.';
    }

    async function persist(level, message, metadata = {}) {
        const normalizedMetadata = normalizeMetadata(enrichMetadataWithRequestContext(metadata));
        const normalizedMessage = typeof message === 'string' ? message : String(message || 'Application log event');
        const source = normalizedMetadata.source || DEFAULT_SOURCE;
        let reservedPosition;

        try {
            reservedPosition = await reserveChainPosition({
                AuditChainStateModel,
                level,
                message: normalizedMessage,
                metadata: normalizedMetadata,
                source,
                host: typeof osLib.hostname === 'function' ? osLib.hostname() : '',
                clock
            });
        } catch (_error) {
            return false;
        }

        const { entry, entryHash, eventTimestamp, previousHash, sequence } = reservedPosition;

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
                correlationId: normalizedMetadata.correlationId || (normalizedMetadata.where && normalizedMetadata.where.correlationId) || '',
                method: normalizedMetadata.method || (normalizedMetadata.where && normalizedMetadata.where.method) || '',
                path: normalizedMetadata.path || (normalizedMetadata.where && normalizedMetadata.where.path) || '',
                statusCode: Number.isFinite(normalizedMetadata.statusCode) ? normalizedMetadata.statusCode : null,
                ip: normalizedMetadata.ip || (normalizedMetadata.where && normalizedMetadata.where.ip) || '',
                userAgent: normalizedMetadata.userAgent || (normalizedMetadata.where && normalizedMetadata.where.userAgent) || '',
                entryHash,
                previousHash,
                sequence,
                eventTimestamp,
                metadata: entry.metadata
            });
            return true;
        } catch (_error) {
            await rollbackChainReservation(AuditChainStateModel, reservedPosition);
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
        const captureSucceeded = Boolean(persisted || forwarded);

        if (requireRemoteSuccess && !(persisted && forwarded)) {
            const failure = new Error('Required immutable audit delivery failed.');
            failure.code = 'REQUIRED_AUDIT_DELIVERY_FAILED';
            failure.auditDelivery = {
                level,
                message: typeof message === 'string' ? message : String(message || 'Application log event'),
                persisted,
                forwarded
            };

            updateDeliveryState({
                persisted,
                forwarded,
                error: failure
            });

            if (typeof onRequiredFailure === 'function') {
                await onRequiredFailure(failure);
            }

            if (throwOnRequiredFailure) {
                throw failure;
            }

            return false;
        }

        updateDeliveryState({
            persisted,
            forwarded,
            error: captureSucceeded ? null : new Error('Immutable audit delivery failed.')
        });

        return captureSucceeded;
    }

    return {
        enabled: true,
        requireRemoteSuccess: Boolean(requireRemoteSuccess),
        getDeliveryState: () => ({
            ...deliveryState,
            lastOutcome: {
                ...deliveryState.lastOutcome
            }
        }),
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
