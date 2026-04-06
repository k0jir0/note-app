const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    collectGitLogEntries,
    collectGovernanceDiff,
    normalizeSinceArgument,
    parseArgs,
    parseGitLogOutput,
    writeGovernanceDiffReport
} = require('../scripts/collect-governance-diff');

describe('Governance diff collection', () => {
    it('parses optional CLI arguments', () => {
        const options = parseArgs([
            '--since=2025-04-01',
            '--output=artifacts/itsg33/annual-review/governance-diff.json'
        ]);

        expect(options).to.deep.equal({
            since: '2025-04-01',
            outputFile: 'artifacts/itsg33/annual-review/governance-diff.json'
        });
    });

    it('normalizes the comparison window', () => {
        expect(normalizeSinceArgument('2025-04-01T15:30:00.000Z')).to.equal('2025-04-01');
        expect(normalizeSinceArgument('')).to.match(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('parses git log output into structured commit records', () => {
        const entries = parseGitLogOutput([
            'abc123\t2026-04-05\tUpdate annual review workflow',
            'def456\t2026-04-01\tRefresh ITSG-33 control matrix'
        ].join('\n'));

        expect(entries).to.deep.equal([
            {
                commit: 'abc123',
                date: '2026-04-05',
                subject: 'Update annual review workflow'
            },
            {
                commit: 'def456',
                date: '2026-04-01',
                subject: 'Refresh ITSG-33 control matrix'
            }
        ]);
    });

    it('collects section-specific git history and builds a report', () => {
        const observedCalls = [];
        const report = collectGovernanceDiff({
            since: '2025-04-01',
            cwd: 'C:\\repo'
        }, {
            collectedAt: new Date('2026-04-06T12:00:00.000Z'),
            sections: [
                {
                    id: 'docs',
                    label: 'Docs',
                    paths: ['docs/itsg33-review.md']
                },
                {
                    id: 'workflows',
                    label: 'Workflows',
                    paths: ['.github/workflows']
                }
            ],
            execFileSyncImpl: (_command, args) => {
                observedCalls.push(args);

                if (args[0] === 'rev-parse') {
                    return 'ba4ac20\n';
                }

                if (args.includes('docs/itsg33-review.md')) {
                    return 'abc123\t2026-04-05\tRefresh ITSG-33 review\n';
                }

                return '';
            }
        });

        expect(observedCalls[0]).to.deep.equal(['rev-parse', 'HEAD']);
        expect(report).to.deep.equal({
            generatedAt: '2026-04-06T12:00:00.000Z',
            since: '2025-04-01',
            headCommit: 'ba4ac20',
            summary: {
                sectionsWithChanges: 1,
                totalCommitReferences: 1
            },
            sections: [
                {
                    id: 'docs',
                    label: 'Docs',
                    paths: ['docs/itsg33-review.md'],
                    commitCount: 1,
                    latestCommit: {
                        commit: 'abc123',
                        date: '2026-04-05',
                        subject: 'Refresh ITSG-33 review'
                    },
                    commits: [{
                        commit: 'abc123',
                        date: '2026-04-05',
                        subject: 'Refresh ITSG-33 review'
                    }]
                },
                {
                    id: 'workflows',
                    label: 'Workflows',
                    paths: ['.github/workflows'],
                    commitCount: 0,
                    latestCommit: null,
                    commits: []
                }
            ]
        });
    });

    it('collects git entries for a section', () => {
        const entries = collectGitLogEntries({
            paths: ['docs/itsg33-review.md']
        }, {
            since: '2025-04-01',
            cwd: 'C:\\repo',
            execFileSyncImpl: (_command, args) => {
                expect(args).to.deep.equal([
                    'log',
                    '--since=2025-04-01',
                    '--date=short',
                    '--pretty=format:%H%x09%ad%x09%s',
                    '--',
                    'docs/itsg33-review.md'
                ]);
                return 'abc123\t2026-04-05\tRefresh ITSG-33 review\n';
            }
        });

        expect(entries).to.deep.equal([{
            commit: 'abc123',
            date: '2026-04-05',
            subject: 'Refresh ITSG-33 review'
        }]);
    });

    it('writes the collected report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-governance-diff-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'governance-diff.json');
        const report = {
            generatedAt: '2026-04-06T12:00:00.000Z',
            summary: {
                sectionsWithChanges: 1
            }
        };

        const writtenPath = writeGovernanceDiffReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));

        expect(writtenPath).to.equal(path.resolve(outputFile));
        expect(persisted.summary.sectionsWithChanges).to.equal(1);
    });
});
