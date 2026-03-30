const crypto = require('crypto');

const { getRequestContext } = require('./requestContext');

let telemetryClient = {
    enabled: false,
    audit: async () => false
};

function configureDatabaseTelemetry({ client } = {}) {
    telemetryClient = client && typeof client.audit === 'function'
        ? client
        : {
            enabled: false,
            audit: async () => false
        };
}

function isPlainObject(value) {
    return Boolean(value)
        && typeof value === 'object'
        && !Array.isArray(value)
        && !(value instanceof Date)
        && !Buffer.isBuffer(value);
}

function toPlainObject(document) {
    if (!document) {
        return null;
    }

    if (typeof document.toObject === 'function') {
        return document.toObject({ depopulate: true });
    }

    return { ...document };
}

function digestValue(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function summarizeDocument(document) {
    const plain = toPlainObject(document);
    if (!plain) {
        return null;
    }

    return {
        id: plain._id != null ? String(plain._id) : '',
        topLevelKeys: Object.keys(plain).sort(),
        snapshotHash: digestValue(plain)
    };
}

function collectChangedPathsFromUpdate(update, prefix = '') {
    if (!update || typeof update !== 'object') {
        return [];
    }

    const changedPaths = [];

    Object.entries(update).forEach(([key, value]) => {
        if (key.startsWith('$') && isPlainObject(value)) {
            Object.keys(value).forEach((nestedKey) => {
                changedPaths.push(nestedKey);
            });
            return;
        }

        if (isPlainObject(value)) {
            changedPaths.push(...collectChangedPathsFromUpdate(value, `${prefix}${key}.`));
            return;
        }

        changedPaths.push(`${prefix}${key}`);
    });

    return [...new Set(changedPaths)].sort();
}

function summarizeUpdate(update) {
    if (!update || typeof update !== 'object') {
        return {
            operators: [],
            changedPaths: [],
            updateHash: ''
        };
    }

    return {
        operators: Object.keys(update).filter((key) => key.startsWith('$')).sort(),
        changedPaths: collectChangedPathsFromUpdate(update),
        updateHash: digestValue(update)
    };
}

function resolveActor(context) {
    const req = context && context.req ? context.req : null;
    if (req && req.user) {
        return {
            type: 'user',
            userId: req.user._id != null ? String(req.user._id) : '',
            email: req.user.email || ''
        };
    }

    if (req) {
        return {
            type: 'anonymous',
            userId: '',
            email: ''
        };
    }

    return {
        type: 'system',
        userId: '',
        email: ''
    };
}

function resolveWhere(context) {
    const req = context && context.req ? context.req : null;
    if (!req) {
        return {
            channel: 'system',
            requestId: context && context.requestId ? context.requestId : '',
            method: '',
            path: '',
            ip: '',
            userAgent: ''
        };
    }

    const forwardedFor = req.headers && req.headers['x-forwarded-for'];
    const ip = typeof forwardedFor === 'string' && forwardedFor.trim()
        ? forwardedFor.split(',')[0].trim()
        : (req.ip || (req.socket && req.socket.remoteAddress) || '');

    return {
        channel: 'http',
        requestId: context && context.requestId ? context.requestId : '',
        method: String(req.method || 'GET').toUpperCase(),
        path: String(req.originalUrl || req.path || ''),
        ip,
        userAgent: typeof req.get === 'function' ? String(req.get('user-agent') || '') : ''
    };
}

function buildTelemetryEvent({ modelName, action, operation, documentId, before, after, changeSet }) {
    const context = getRequestContext();

    return {
        category: 'db-state-change',
        who: resolveActor(context),
        what: {
            model: modelName,
            action,
            documentId,
            before,
            after,
            changeSet
        },
        when: new Date().toISOString(),
        where: resolveWhere(context),
        how: {
            mechanism: operation,
            telemetryVersion: 1
        }
    };
}

async function emitTelemetryEvent(event) {
    if (!telemetryClient || !telemetryClient.enabled || typeof telemetryClient.audit !== 'function') {
        return false;
    }

    return telemetryClient.audit('Database state changed', event);
}

function attachTelemetryLocals(target, value) {
    if (!target) {
        return;
    }

    if (!target.$locals || typeof target.$locals !== 'object') {
        target.$locals = {};
    }

    target.$locals.databaseTelemetry = value;
}

function readTelemetryLocals(target) {
    return target && target.$locals ? target.$locals.databaseTelemetry : null;
}

function applyDatabaseTelemetry(schema, { modelName } = {}) {
    schema.pre('save', async function captureBeforeSave() {
        const before = !this.isNew && this._id
            ? await this.constructor.findById(this._id).lean()
            : null;

        attachTelemetryLocals(this, {
            action: this.isNew ? 'create' : 'update',
            operation: 'save',
            before,
            changedPaths: typeof this.modifiedPaths === 'function' ? this.modifiedPaths() : []
        });
    });

    schema.post('save', async function emitSaveTelemetry(document, next) {
        try {
            const telemetry = readTelemetryLocals(this) || {};
            await emitTelemetryEvent(buildTelemetryEvent({
                modelName,
                action: telemetry.action || 'update',
                operation: telemetry.operation || 'save',
                documentId: document && document._id != null ? String(document._id) : '',
                before: summarizeDocument(telemetry.before),
                after: summarizeDocument(document),
                changeSet: {
                    changedPaths: Array.isArray(telemetry.changedPaths) ? telemetry.changedPaths.slice().sort() : []
                }
            }));
            next();
        } catch (error) {
            next(error);
        }
    });

    schema.post('insertMany', async function emitInsertManyTelemetry(documents, next) {
        try {
            await Promise.all((Array.isArray(documents) ? documents : []).map((document) => emitTelemetryEvent(buildTelemetryEvent({
                modelName,
                action: 'create',
                operation: 'insertMany',
                documentId: document && document._id != null ? String(document._id) : '',
                before: null,
                after: summarizeDocument(document),
                changeSet: {
                    changedPaths: Object.keys(toPlainObject(document) || {}).sort()
                }
            }))));
            next();
        } catch (error) {
            next(error);
        }
    });

    ['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndDelete', 'deleteOne', 'deleteMany'].forEach((operation) => {
        schema.pre(operation, async function captureBeforeMutation() {
            const filter = typeof this.getFilter === 'function' ? this.getFilter() : {};
            const beforeDocs = await this.model.find(filter).lean();
            attachTelemetryLocals(this, {
                operation,
                filter,
                beforeDocs,
                updateSummary: summarizeUpdate(typeof this.getUpdate === 'function' ? this.getUpdate() : null)
            });
        });
    });

    ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach((operation) => {
        schema.post(operation, async function emitUpdateTelemetry(result, next) {
            try {
                const telemetry = readTelemetryLocals(this) || {};
                const beforeDocs = Array.isArray(telemetry.beforeDocs) ? telemetry.beforeDocs : [];
                const ids = beforeDocs.map((document) => String(document._id));
                const afterDocs = ids.length > 0
                    ? await this.model.find({ _id: { $in: ids } }).lean()
                    : [];
                const afterById = new Map(afterDocs.map((document) => [String(document._id), document]));

                await Promise.all(beforeDocs.map((beforeDoc) => emitTelemetryEvent(buildTelemetryEvent({
                    modelName,
                    action: 'update',
                    operation,
                    documentId: String(beforeDoc._id),
                    before: summarizeDocument(beforeDoc),
                    after: summarizeDocument(afterById.get(String(beforeDoc._id)) || null),
                    changeSet: telemetry.updateSummary || summarizeUpdate(null)
                }))));

                next();
            } catch (error) {
                next(error);
            }
        });
    });

    ['findOneAndDelete', 'deleteOne', 'deleteMany'].forEach((operation) => {
        schema.post(operation, async function emitDeleteTelemetry(result, next) {
            try {
                const telemetry = readTelemetryLocals(this) || {};
                const beforeDocs = Array.isArray(telemetry.beforeDocs) ? telemetry.beforeDocs : [];

                await Promise.all(beforeDocs.map((beforeDoc) => emitTelemetryEvent(buildTelemetryEvent({
                    modelName,
                    action: 'delete',
                    operation,
                    documentId: String(beforeDoc._id),
                    before: summarizeDocument(beforeDoc),
                    after: null,
                    changeSet: {
                        changedPaths: []
                    }
                }))));

                next();
            } catch (error) {
                next(error);
            }
        });
    });
}

async function runTelemetryAwareBulkWrite({ model, modelName, operations = [], bulkWriteOptions = {} } = {}) {
    if (!model || typeof model.bulkWrite !== 'function') {
        throw new TypeError('A model with bulkWrite() is required');
    }

    const canQueryDocuments = typeof model.find === 'function';
    const operationContexts = [];

    for (const operation of operations) {
        if (!operation || typeof operation !== 'object') {
            continue;
        }

        if (operation.updateOne) {
            const filter = operation.updateOne.filter || {};
            const beforeDocs = canQueryDocuments
                ? await model.find(filter).lean()
                : [];
            operationContexts.push({
                action: 'update',
                operation: 'bulkWrite.updateOne',
                beforeDocs,
                updateSummary: summarizeUpdate(operation.updateOne.update || {})
            });
            continue;
        }

        if (operation.updateMany) {
            const filter = operation.updateMany.filter || {};
            const beforeDocs = canQueryDocuments
                ? await model.find(filter).lean()
                : [];
            operationContexts.push({
                action: 'update',
                operation: 'bulkWrite.updateMany',
                beforeDocs,
                updateSummary: summarizeUpdate(operation.updateMany.update || {})
            });
            continue;
        }

        if (operation.deleteOne) {
            const filter = operation.deleteOne.filter || {};
            const beforeDocs = canQueryDocuments
                ? await model.find(filter).lean()
                : [];
            operationContexts.push({
                action: 'delete',
                operation: 'bulkWrite.deleteOne',
                beforeDocs,
                updateSummary: {
                    changedPaths: []
                }
            });
            continue;
        }

        if (operation.deleteMany) {
            const filter = operation.deleteMany.filter || {};
            const beforeDocs = canQueryDocuments
                ? await model.find(filter).lean()
                : [];
            operationContexts.push({
                action: 'delete',
                operation: 'bulkWrite.deleteMany',
                beforeDocs,
                updateSummary: {
                    changedPaths: []
                }
            });
            continue;
        }

        if (operation.insertOne) {
            operationContexts.push({
                action: 'create',
                operation: 'bulkWrite.insertOne',
                insertDocument: operation.insertOne.document || null
            });
        }
    }

    const result = await model.bulkWrite(operations, bulkWriteOptions);

    for (const context of operationContexts) {
        if (context.action === 'create' && context.insertDocument) {
            await emitTelemetryEvent(buildTelemetryEvent({
                modelName,
                action: context.action,
                operation: context.operation,
                documentId: context.insertDocument && context.insertDocument._id != null ? String(context.insertDocument._id) : '',
                before: null,
                after: summarizeDocument(context.insertDocument),
                changeSet: {
                    changedPaths: Object.keys(toPlainObject(context.insertDocument) || {}).sort()
                }
            }));
            continue;
        }

        if (!canQueryDocuments || !Array.isArray(context.beforeDocs) || context.beforeDocs.length === 0) {
            continue;
        }

        const ids = context.beforeDocs.map((document) => String(document._id));
        const afterDocs = ids.length > 0
            ? await model.find({ _id: { $in: ids } }).lean()
            : [];
        const afterById = new Map(afterDocs.map((document) => [String(document._id), document]));

        await Promise.all(context.beforeDocs.map((beforeDoc) => emitTelemetryEvent(buildTelemetryEvent({
            modelName,
            action: context.action,
            operation: context.operation,
            documentId: String(beforeDoc._id),
            before: summarizeDocument(beforeDoc),
            after: context.action === 'delete'
                ? null
                : summarizeDocument(afterById.get(String(beforeDoc._id)) || null),
            changeSet: context.updateSummary
        }))));
    }

    return result;
}

module.exports = {
    applyDatabaseTelemetry,
    buildTelemetryEvent,
    configureDatabaseTelemetry,
    runTelemetryAwareBulkWrite,
    summarizeDocument,
    summarizeUpdate
};
