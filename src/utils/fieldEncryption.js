const { encryptText, decryptText } = require('./noteEncryption');

function isTraversableObject(value) {
    return Boolean(value)
        && typeof value === 'object'
        && !Array.isArray(value)
        && !(value instanceof Date)
        && !Buffer.isBuffer(value)
        && value._bsontype !== 'ObjectId';
}

function getPathSegments(path) {
    return String(path || '')
        .split('.')
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function readPathValue(target, path) {
    if (!target) {
        return undefined;
    }

    if (typeof target.get === 'function') {
        return target.get(path);
    }

    return getPathSegments(path).reduce((current, segment) => {
        if (current == null) {
            return undefined;
        }

        return current[segment];
    }, target);
}

function writePathValue(target, path, value) {
    if (!target) {
        return;
    }

    if (typeof target.set === 'function') {
        target.set(path, value);
        return;
    }

    const segments = getPathSegments(path);
    if (!segments.length) {
        return;
    }

    const lastSegment = segments.pop();
    const container = segments.reduce((current, segment) => {
        if (!isTraversableObject(current[segment]) && !Array.isArray(current[segment])) {
            current[segment] = {};
        }

        return current[segment];
    }, target);

    container[lastSegment] = value;
}

function transformValueRecursively(value, stringTransformer, options = {}) {
    const preserveKeys = new Set(options.preserveKeys || []);

    if (typeof value === 'string') {
        return stringTransformer(value);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => transformValueRecursively(entry, stringTransformer, options));
    }

    if (!isTraversableObject(value)) {
        return value;
    }

    const transformed = {};

    Object.entries(value).forEach(([key, entryValue]) => {
        if (preserveKeys.has(key)) {
            transformed[key] = entryValue;
            return;
        }

        transformed[key] = transformValueRecursively(entryValue, stringTransformer, options);
    });

    return transformed;
}

function transformPathValue(target, path, stringTransformer) {
    const currentValue = readPathValue(target, path);

    if (typeof currentValue !== 'string') {
        return;
    }

    writePathValue(target, path, stringTransformer(currentValue));
}

function transformDeepPathValue(target, path, stringTransformer, options = {}) {
    const currentValue = readPathValue(target, path);

    if (currentValue === undefined) {
        return;
    }

    writePathValue(target, path, transformValueRecursively(currentValue, stringTransformer, options));
}

function transformArrayEntries(target, arrayPath, entryTransformer) {
    const currentValue = readPathValue(target, arrayPath);

    if (!Array.isArray(currentValue)) {
        return;
    }

    writePathValue(
        target,
        arrayPath,
        currentValue.map((entry) => {
            if (!isTraversableObject(entry)) {
                return entry;
            }

            const clonedEntry = { ...entry };
            entryTransformer(clonedEntry);
            return clonedEntry;
        })
    );
}

function transformUpdatePayload(update, payloadTransformer) {
    if (!update || typeof update !== 'object') {
        return update;
    }

    payloadTransformer(update);

    if (update.$set && typeof update.$set === 'object') {
        payloadTransformer(update.$set);
    }

    if (update.$setOnInsert && typeof update.$setOnInsert === 'object') {
        payloadTransformer(update.$setOnInsert);
    }

    return update;
}

function transformBulkWriteOperations(operations, updateTransformer) {
    if (!Array.isArray(operations)) {
        return operations;
    }

    operations.forEach((operation) => {
        if (!operation || typeof operation !== 'object') {
            return;
        }

        if (operation.updateOne && operation.updateOne.update) {
            updateTransformer(operation.updateOne.update);
        }

        if (operation.updateMany && operation.updateMany.update) {
            updateTransformer(operation.updateMany.update);
        }

        if (operation.replaceOne && operation.replaceOne.replacement) {
            updateTransformer(operation.replaceOne.replacement);
        }
    });

    return operations;
}

function decryptDocuments(documents, decryptDocument) {
    if (Array.isArray(documents)) {
        documents.forEach((document) => decryptDocument(document));
        return;
    }

    decryptDocument(documents);
}

function resolveHookArgs(primaryArg, secondaryArg) {
    if (typeof primaryArg === 'function') {
        return {
            next: primaryArg,
            value: secondaryArg
        };
    }

    return {
        next: null,
        value: primaryArg
    };
}

function runSynchronousHook(next, operation) {
    try {
        operation();
    } catch (error) {
        if (typeof next === 'function') {
            next(error);
            return;
        }

        throw error;
    }

    if (typeof next === 'function') {
        next();
    }
}

function applyFieldEncryption(schema, handlers) {
    const { encryptDocument, decryptDocument, encryptUpdatePayload } = handlers;

    schema.pre('save', function encryptSensitiveFields(next) {
        return runSynchronousHook(next, () => {
            encryptDocument(this);
        });
    });

    schema.pre('insertMany', function encryptInsertedDocuments(nextOrDocuments, maybeDocuments) {
        const { next, value: documents } = resolveHookArgs(nextOrDocuments, maybeDocuments);

        return runSynchronousHook(next, () => {
            if (Array.isArray(documents)) {
                documents.forEach((document) => encryptDocument(document));
            }
        });
    });

    ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach((operation) => {
        schema.pre(operation, function encryptSensitiveUpdate(next) {
            return runSynchronousHook(next, () => {
                const update = this.getUpdate();
                this.setUpdate(encryptUpdatePayload(update));
            });
        });
    });

    schema.post('save', function decryptSavedDocument(document, next) {
        return runSynchronousHook(next, () => {
            decryptDocument(document);
        });
    });

    schema.post('insertMany', function decryptInsertedDocuments(documents, next) {
        return runSynchronousHook(next, () => {
            decryptDocuments(documents, decryptDocument);
        });
    });

    schema.post('find', function decryptFoundDocuments(documents, next) {
        return runSynchronousHook(next, () => {
            decryptDocuments(documents, decryptDocument);
        });
    });

    schema.post('findOne', function decryptFoundDocument(document, next) {
        return runSynchronousHook(next, () => {
            decryptDocument(document);
        });
    });

    schema.post('findOneAndUpdate', function decryptUpdatedDocument(document, next) {
        return runSynchronousHook(next, () => {
            decryptDocument(document);
        });
    });
}

module.exports = {
    encryptText,
    decryptText,
    transformPathValue,
    transformDeepPathValue,
    transformArrayEntries,
    transformUpdatePayload,
    transformBulkWriteOperations,
    applyFieldEncryption
};
