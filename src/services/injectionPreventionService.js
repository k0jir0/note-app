function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function describeUnsafeKey(key = '') {
    if (String(key).startsWith('$')) {
        return 'Keys starting with "$" can be interpreted as query or update operators.';
    }

    return 'Keys containing "." can target nested document paths and bypass strict field intent.';
}

function findUnsafeObjectKeys(value, options = {}, currentPath = '', findings = []) {
    const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 12;
    const depth = Number.isInteger(options.depth) ? options.depth : 0;

    if (depth > maxDepth) {
        findings.push({
            path: currentPath || '(root)',
            key: '(depth-limit)',
            reason: 'Input nesting exceeds the supported inspection depth.'
        });
        return findings;
    }

    if (Array.isArray(value)) {
        value.forEach((entry, index) => {
            findUnsafeObjectKeys(entry, { ...options, depth: depth + 1 }, `${currentPath}[${index}]`, findings);
        });
        return findings;
    }

    if (!isPlainObject(value)) {
        return findings;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
        const nextPath = currentPath ? `${currentPath}.${key}` : key;

        if (key.startsWith('$') || key.includes('.')) {
            findings.push({
                path: nextPath,
                key,
                reason: describeUnsafeKey(key)
            });
        }

        findUnsafeObjectKeys(nestedValue, { ...options, depth: depth + 1 }, nextPath, findings);
    });

    return findings;
}

function inspectRequestInput({ body, query, params } = {}) {
    const surfaces = [
        ['body', body],
        ['query', query],
        ['params', params]
    ];

    const findings = surfaces.flatMap(([surface, value]) => (
        findUnsafeObjectKeys(value).map((finding) => ({
            surface,
            ...finding
        }))
    ));

    return {
        blocked: findings.length > 0,
        findings,
        summary: findings.length
            ? 'Potential injection-shaped input was rejected before it reached a database query.'
            : 'No operator-shaped input was detected in the request surfaces.'
    };
}

function applyMongooseInjectionDefaults(mongooseLib) {
    if (!mongooseLib || typeof mongooseLib.set !== 'function') {
        return {
            sanitizeFilter: false,
            strictQuery: false
        };
    }

    mongooseLib.set('sanitizeFilter', true);
    mongooseLib.set('strictQuery', true);

    return {
        sanitizeFilter: mongooseLib.get('sanitizeFilter') === true,
        strictQuery: mongooseLib.get('strictQuery') === true
    };
}

function buildMongooseInjectionPosture(mongooseLib) {
    if (!mongooseLib || typeof mongooseLib.get !== 'function') {
        return {
            orm: 'Mongoose',
            sanitizeFilter: false,
            strictQuery: false
        };
    }

    return {
        orm: 'Mongoose',
        sanitizeFilter: mongooseLib.get('sanitizeFilter') === true,
        strictQuery: mongooseLib.get('strictQuery') === true
    };
}

module.exports = {
    applyMongooseInjectionDefaults,
    buildMongooseInjectionPosture,
    findUnsafeObjectKeys,
    inspectRequestInput,
    isPlainObject
};
