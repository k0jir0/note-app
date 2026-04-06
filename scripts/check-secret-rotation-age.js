#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');

const ROOT_DIR = path.join(__dirname, '..');

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parsePositiveInteger(rawValue, fieldName, fallback = null) {
    if (!String(rawValue || '').trim()) {
        return fallback;
    }

    const parsedValue = Number.parseInt(String(rawValue).trim(), 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }

    return parsedValue;
}

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        const specsJson = readArgValue(argument, 'specs-json');
        if (specsJson) {
            return {
                ...options,
                specsJson
            };
        }

        const specsFile = readArgValue(argument, 'specs-file');
        if (specsFile) {
            return {
                ...options,
                specsFile
            };
        }

        const defaultMaxAgeDays = readArgValue(argument, 'default-max-age-days');
        if (defaultMaxAgeDays) {
            return {
                ...options,
                defaultMaxAgeDays: parsePositiveInteger(defaultMaxAgeDays, 'default-max-age-days', null)
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        outputFile: '',
        specsJson: '',
        specsFile: '',
        defaultMaxAgeDays: null
    });
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseRotationSpecs(rawValue, { source = 'configuration' } = {}) {
    const trimmedValue = String(rawValue || '').trim();
    if (!trimmedValue) {
        return [];
    }

    let parsedValue;
    try {
        parsedValue = JSON.parse(trimmedValue);
    } catch (error) {
        throw new Error(`Unable to parse ${source} as JSON: ${error.message}`);
    }

    if (!Array.isArray(parsedValue)) {
        throw new Error(`${source} must be a JSON array.`);
    }

    return parsedValue;
}

function resolveRotationSpecs(options = {}, env = process.env) {
    if (String(options.specsJson || '').trim()) {
        return parseRotationSpecs(options.specsJson, { source: '--specs-json' });
    }

    if (String(options.specsFile || '').trim()) {
        const filePath = path.resolve(process.cwd(), options.specsFile);
        return parseRotationSpecs(fs.readFileSync(filePath, 'utf8'), {
            source: path.relative(process.cwd(), filePath) || filePath
        });
    }

    return parseRotationSpecs(env.ITSG33_SECRET_ROTATION_SPECS || '', {
        source: 'ITSG33_SECRET_ROTATION_SPECS'
    });
}

function calculateAgeDays(rotatedAt, referenceTime = new Date()) {
    const rotationDate = rotatedAt instanceof Date ? rotatedAt : new Date(rotatedAt);
    const referenceDate = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);

    if (Number.isNaN(rotationDate.getTime()) || Number.isNaN(referenceDate.getTime())) {
        return null;
    }

    return Math.floor((referenceDate.getTime() - rotationDate.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeSecretRotationSpec(spec = {}, {
    defaultMaxAgeDays = null,
    referenceTime = new Date()
} = {}) {
    const normalizedId = String(spec.id || spec.name || '').trim();
    const normalizedLabel = String(spec.label || normalizedId || 'Unnamed secret').trim() || 'Unnamed secret';
    const maxAgeDays = parsePositiveInteger(spec.maxAgeDays, `${normalizedLabel}.maxAgeDays`, defaultMaxAgeDays);
    const warnAgeDays = parsePositiveInteger(spec.warnAgeDays, `${normalizedLabel}.warnAgeDays`, null);
    const rotatedAtIso = toIsoString(spec.rotatedAt);
    const ageDays = calculateAgeDays(spec.rotatedAt, referenceTime);

    let status = 'ok';
    let reason = 'Rotation age is within policy.';

    if (!normalizedId) {
        status = 'invalid';
        reason = 'Secret rotation spec is missing id, name, or label.';
    } else if (!maxAgeDays) {
        status = 'invalid';
        reason = 'No maxAgeDays policy was provided.';
    } else if (!rotatedAtIso || ageDays === null) {
        status = 'invalid';
        reason = 'rotatedAt is missing or invalid.';
    } else if (ageDays < 0) {
        status = 'invalid';
        reason = 'rotatedAt is in the future.';
    } else {
        const effectiveWarnAgeDays = warnAgeDays || Math.max(1, Math.ceil(maxAgeDays * 0.8));

        if (ageDays > maxAgeDays) {
            status = 'stale';
            reason = `Rotation age ${ageDays}d exceeds the ${maxAgeDays}d policy.`;
        } else if (ageDays >= effectiveWarnAgeDays) {
            status = 'warn';
            reason = `Rotation age ${ageDays}d is approaching the ${maxAgeDays}d policy.`;
        }
    }

    return {
        id: normalizedId,
        label: normalizedLabel,
        owner: String(spec.owner || '').trim(),
        source: String(spec.source || '').trim(),
        rotatedAt: rotatedAtIso,
        ageDays,
        maxAgeDays: maxAgeDays || null,
        warnAgeDays: warnAgeDays || (maxAgeDays ? Math.max(1, Math.ceil(maxAgeDays * 0.8)) : null),
        status,
        reason
    };
}

function buildSecretRotationReport({
    specs = [],
    checkedAt = new Date(),
    defaultMaxAgeDays = null
} = {}) {
    const normalizedSpecs = Array.isArray(specs)
        ? specs.map((spec) => normalizeSecretRotationSpec(spec, {
            defaultMaxAgeDays,
            referenceTime: checkedAt
        }))
        : [];

    if (normalizedSpecs.length === 0) {
        return {
            checkedAt: toIsoString(checkedAt),
            skipped: true,
            reason: 'No secret rotation specifications were configured.',
            summary: {
                totalSecrets: 0,
                ok: 0,
                warn: 0,
                stale: 0,
                invalid: 0
            },
            secrets: []
        };
    }

    const summary = normalizedSpecs.reduce((accumulator, spec) => {
        accumulator.totalSecrets += 1;
        if (Object.prototype.hasOwnProperty.call(accumulator, spec.status)) {
            accumulator[spec.status] += 1;
        }
        return accumulator;
    }, {
        totalSecrets: 0,
        ok: 0,
        warn: 0,
        stale: 0,
        invalid: 0
    });

    return {
        checkedAt: toIsoString(checkedAt),
        skipped: false,
        reason: '',
        summary,
        secrets: normalizedSpecs
    };
}

function assertSecretRotationReport(report) {
    if (!report || typeof report !== 'object') {
        return ['Secret rotation report is missing or invalid.'];
    }

    if (report.skipped) {
        return [];
    }

    const failures = [];

    for (const secret of Array.isArray(report.secrets) ? report.secrets : []) {
        if (secret.status === 'stale' || secret.status === 'invalid') {
            failures.push(`${secret.label}: ${secret.reason}`);
        }
    }

    return failures;
}

function writeSecretRotationReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    loadRuntimeEnvironment({ rootDir: ROOT_DIR });

    const options = parseArgs(process.argv.slice(2));
    const specs = resolveRotationSpecs(options);
    const defaultMaxAgeDays = options.defaultMaxAgeDays || parsePositiveInteger(
        process.env.ITSG33_DEFAULT_SECRET_ROTATION_MAX_AGE_DAYS,
        'ITSG33_DEFAULT_SECRET_ROTATION_MAX_AGE_DAYS',
        null
    );
    const report = buildSecretRotationReport({
        specs,
        checkedAt: new Date(),
        defaultMaxAgeDays
    });
    const failures = assertSecretRotationReport(report);

    if (options.outputFile) {
        const outputPath = writeSecretRotationReport(options.outputFile, report);
        console.log(`Wrote secret rotation report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (failures.length > 0) {
        failures.forEach((failure) => {
            console.error(`[itsg33] ${failure}`);
        });
        process.exitCode = 1;
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Secret rotation check failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    assertSecretRotationReport,
    buildSecretRotationReport,
    calculateAgeDays,
    normalizeSecretRotationSpec,
    parseArgs,
    parseRotationSpecs,
    resolveRotationSpecs,
    writeSecretRotationReport
};
