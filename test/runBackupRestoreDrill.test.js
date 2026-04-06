const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    parseArgs,
    probeHttpEndpoint,
    resolveBackupRestoreOptions,
    runBackupRestoreDrill,
    sanitizeUrlForReport,
    validateBackupRestoreOptions,
    writeBackupRestoreReport
} = require('../scripts/run-backup-restore-drill');

describe('Backup and restore drill runner', () => {
    it('parses backup drill arguments', () => {
        const options = parseArgs([
            '--backup-source=staging snapshot',
            '--restore-target=recovery sandbox',
            '--drill-environment=staging',
            '--restore-command=node restore.js',
            '--health-url=https://helios.example/healthz',
            '--auth-url=https://helios.example/auth/login',
            '--validation-command=node verify.js',
            '--output=artifacts/itsg33/backup-restore.json'
        ]);

        expect(options).to.deep.equal({
            backupSource: 'staging snapshot',
            restoreTarget: 'recovery sandbox',
            drillEnvironment: 'staging',
            prepareCommand: '',
            restoreCommand: 'node restore.js',
            postRestoreCommand: '',
            validationCommand: 'node verify.js',
            outputFile: 'artifacts/itsg33/backup-restore.json',
            healthUrl: 'https://helios.example/healthz',
            authUrl: 'https://helios.example/auth/login',
            healthBearerToken: '',
            authBearerToken: '',
            timeoutMs: 900000,
            httpTimeoutMs: 5000,
            authExpectedStatus: 200,
            healthExpectedStatus: 200
        });
    });

    it('requires a restore command', () => {
        expect(() => validateBackupRestoreOptions({ restoreCommand: '' })).to.throw(
            'restoreCommand is required for the backup and restore drill.'
        );
    });

    it('sanitizes URLs before persisting them into the report', () => {
        expect(sanitizeUrlForReport('https://helios.example/auth/login?token=secret')).to.equal(
            'https://helios.example/auth/login'
        );
    });

    it('resolves probe bearer tokens from the environment', () => {
        const options = resolveBackupRestoreOptions({
            restoreCommand: 'restore-command'
        }, {
            ITSG33_RESTORE_HEALTHCHECK_TOKEN: 'health-token',
            ITSG33_RESTORE_AUTH_TOKEN: 'auth-token'
        });

        expect(options.healthBearerToken).to.equal('health-token');
        expect(options.authBearerToken).to.equal('auth-token');
    });

    it('forwards an optional bearer token to protected endpoint probes', async () => {
        let observedRequest = null;

        const report = await probeHttpEndpoint('https://helios.example/healthz', {
            bearerToken: 'health-token',
            fetchImpl: async (url, options) => {
                observedRequest = { url, options };
                return {
                    status: 200
                };
            }
        });

        expect(observedRequest.url).to.equal('https://helios.example/healthz');
        expect(observedRequest.options.headers).to.deep.equal({
            Authorization: 'Bearer health-token'
        });
        expect(report.success).to.equal(true);
    });

    it('runs a successful restore drill with probes and validation', async () => {
        const executedCommands = [];
        const probedUrls = [];

        const report = await runBackupRestoreDrill({
            backupSource: 'staging snapshot',
            restoreTarget: 'recovery sandbox',
            restoreCommand: 'restore-command',
            postRestoreCommand: 'start-command',
            validationCommand: 'verify-protected-route',
            healthUrl: 'https://helios.example/healthz',
            authUrl: 'https://helios.example/auth/login'
        }, {
            executeCommandImpl: async (command) => {
                executedCommands.push(command);
                return {
                    success: true,
                    exitCode: 0,
                    durationMs: 25,
                    timedOut: false,
                    reason: 'Command completed successfully.'
                };
            },
            probeHttpEndpointImpl: async (url, { expectedStatus }) => {
                probedUrls.push({ url, expectedStatus });
                return {
                    executed: true,
                    skipped: false,
                    success: true,
                    url,
                    expectedStatus,
                    statusCode: expectedStatus,
                    durationMs: 10,
                    reason: 'Endpoint responded with expected status.'
                };
            }
        });

        expect(executedCommands).to.deep.equal([
            'restore-command',
            'start-command',
            'verify-protected-route'
        ]);
        expect(probedUrls).to.deep.equal([
            { url: 'https://helios.example/healthz', expectedStatus: 200 },
            { url: 'https://helios.example/auth/login', expectedStatus: 200 }
        ]);
        expect(report.success).to.equal(true);
        expect(report.backupSource).to.equal('staging snapshot');
        expect(report.restoreTarget).to.equal('recovery sandbox');
        expect(report.summary.restoreDurationMs).to.equal(25);
        expect(report.steps.validation.success).to.equal(true);
    });

    it('skips later verification steps when the restore fails', async () => {
        const report = await runBackupRestoreDrill({
            restoreCommand: 'restore-command',
            validationCommand: 'verify-protected-route',
            healthUrl: 'https://helios.example/healthz',
            authUrl: 'https://helios.example/auth/login'
        }, {
            executeCommandImpl: async () => ({
                success: false,
                exitCode: 1,
                durationMs: 30,
                timedOut: false,
                reason: 'Command exited with code 1.'
            }),
            probeHttpEndpointImpl: async () => {
                throw new Error('probe should not run after a restore failure');
            }
        });

        expect(report.success).to.equal(false);
        expect(report.failures).to.deep.equal([
            {
                step: 'restore',
                reason: 'Command exited with code 1.'
            }
        ]);
        expect(report.steps.validation).to.deep.equal({
            executed: false,
            skipped: true,
            success: null,
            reason: 'Skipped because the restore step failed.'
        });
    });

    it('writes the drill report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-backup-restore-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'backup-restore.json');
        const report = {
            success: true,
            summary: {
                restoreDurationMs: 25
            }
        };

        const outputPath = writeBackupRestoreReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

        expect(outputPath).to.equal(path.resolve(outputFile));
        expect(persisted.summary.restoreDurationMs).to.equal(25);
    });
});
