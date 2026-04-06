#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GOVERNANCE_SECTIONS = Object.freeze([
    {
        id: 'governanceDocs',
        label: 'Governance docs',
        paths: [
            'docs/itsg33-review.md',
            'docs/itsg33-control-matrix.md',
            'docs/itsg33-evidence-checklist.md',
            'docs/itsg33-operations-runbook.md',
            'docs/branch-protection.md'
        ]
    },
    {
        id: 'workflows',
        label: 'Security and governance workflows',
        paths: [
            '.github/workflows'
        ]
    },
    {
        id: 'securityControls',
        label: 'Security-sensitive application paths',
        paths: [
            'src/app/createApp.js',
            'src/config/runtimeConfig.js',
            'src/middleware/privilegedRuntime.js',
            'src/middleware/immutableRequestAudit.js',
            'src/routes/metrics.js',
            'src/routes/breakGlassRoutes.js',
            'src/services/persistentAuditService.js'
        ]
    }
]);

function readArgValue(argument, name) {
    const prefix = `--${name}=`;
    return argument.startsWith(prefix)
        ? argument.slice(prefix.length).trim()
        : '';
}

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        const since = readArgValue(argument, 'since');
        if (since) {
            return {
                ...options,
                since
            };
        }

        const outputFile = readArgValue(argument, 'output');
        if (outputFile) {
            return {
                ...options,
                outputFile
            };
        }

        throw new Error(`Unknown argument: ${argument}`);
    }, {
        since: '',
        outputFile: ''
    });
}

function toIsoString(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSinceArgument(rawValue = '') {
    const trimmedValue = String(rawValue || '').trim();
    if (!trimmedValue) {
        const fallback = new Date();
        fallback.setUTCFullYear(fallback.getUTCFullYear() - 1);
        return fallback.toISOString().slice(0, 10);
    }

    const parsedDate = new Date(trimmedValue);
    if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
    }

    return trimmedValue;
}

function parseGitLogOutput(rawOutput = '') {
    return String(rawOutput || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [commit, date, ...subjectParts] = line.split('\t');
            return {
                commit: String(commit || '').trim(),
                date: String(date || '').trim(),
                subject: subjectParts.join('\t').trim()
            };
        })
        .filter((entry) => entry.commit && entry.subject);
}

function collectGitLogEntries(section = {}, {
    since = '',
    cwd = process.cwd(),
    execFileSyncImpl = execFileSync
} = {}) {
    const paths = Array.isArray(section.paths) ? section.paths.filter(Boolean) : [];
    if (paths.length === 0) {
        return [];
    }

    const args = [
        'log',
        `--since=${since}`,
        '--date=short',
        '--pretty=format:%H%x09%ad%x09%s',
        '--',
        ...paths
    ];

    const output = execFileSyncImpl('git', args, {
        cwd,
        encoding: 'utf8'
    });

    return parseGitLogOutput(output);
}

function collectGovernanceDiff({
    since = '',
    cwd = process.cwd()
} = {}, {
    execFileSyncImpl = execFileSync,
    sections = GOVERNANCE_SECTIONS,
    collectedAt = new Date()
} = {}) {
    const normalizedSince = normalizeSinceArgument(since);
    const headCommit = String(execFileSyncImpl('git', ['rev-parse', 'HEAD'], {
        cwd,
        encoding: 'utf8'
    }) || '').trim();

    const reportSections = sections.map((section) => {
        const entries = collectGitLogEntries(section, {
            since: normalizedSince,
            cwd,
            execFileSyncImpl
        });

        return {
            id: section.id,
            label: section.label,
            paths: section.paths,
            commitCount: entries.length,
            latestCommit: entries.length > 0 ? entries[0] : null,
            commits: entries.slice(0, 20)
        };
    });

    return {
        generatedAt: toIsoString(collectedAt),
        since: normalizedSince,
        headCommit,
        summary: {
            sectionsWithChanges: reportSections.filter((section) => section.commitCount > 0).length,
            totalCommitReferences: reportSections.reduce((accumulator, section) => accumulator + section.commitCount, 0)
        },
        sections: reportSections
    };
}

function writeGovernanceDiffReport(outputFile, report) {
    const absolutePath = path.resolve(process.cwd(), outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), 'utf8');
    return absolutePath;
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const report = collectGovernanceDiff({
        since: options.since,
        cwd: process.cwd()
    });

    if (options.outputFile) {
        const outputPath = writeGovernanceDiffReport(options.outputFile, report);
        console.log(`Wrote governance diff report to ${path.relative(process.cwd(), outputPath) || outputPath}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }
}

if (require.main === module) {
    run().catch((error) => {
        console.error('[itsg33] Governance diff collection failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}

module.exports = {
    GOVERNANCE_SECTIONS,
    collectGitLogEntries,
    collectGovernanceDiff,
    normalizeSinceArgument,
    parseArgs,
    parseGitLogOutput,
    writeGovernanceDiffReport
};
