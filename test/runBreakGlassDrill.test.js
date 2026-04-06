const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    parseArgs,
    probeBreakGlassHealth,
    resolveBreakGlassDrillOptions,
    runBreakGlassDrill,
    validateBreakGlassDrillOptions,
    writeBreakGlassDrillReport
} = require('../scripts/run-break-glass-drill');

describe('Break-glass drill runner', () => {
    it('parses drill arguments', () => {
        const options = parseArgs([
            '--drill-environment=staging',
            '--activate-command=node activate.js',
            '--reset-command=node reset.js',
            '--validation-command=node validate.js',
            '--audit-validation-command=node audit.js',
            '--health-url=https://helios.example/healthz',
            '--target-mode=read_only',
            '--output=artifacts/itsg33/break-glass-drill.json'
        ]);

        expect(options).to.deep.equal({
            drillEnvironment: 'staging',
            prepareCommand: '',
            activateCommand: 'node activate.js',
            resetCommand: 'node reset.js',
            validationCommand: 'node validate.js',
            auditValidationCommand: 'node audit.js',
            outputFile: 'artifacts/itsg33/break-glass-drill.json',
            baseUrl: '',
            healthUrl: 'https://helios.example/healthz',
            healthBearerToken: '',
            targetMode: 'read_only',
            timeoutMs: 600000,
            httpTimeoutMs: 5000
        });
    });

    it('rejects production break-glass drills', () => {
        expect(() => validateBreakGlassDrillOptions({
            drillEnvironment: 'production',
            activateCommand: 'activate',
            resetCommand: 'reset',
            targetMode: 'offline'
        })).to.throw('Break-glass drills must not target production environments.');
    });

    it('resolves health URLs and tokens from the environment', () => {
        const options = resolveBreakGlassDrillOptions({
            activateCommand: 'activate',
            resetCommand: 'reset'
        }, {
            APP_BASE_URL: 'https://helios.example',
            ITSG33_BREAK_GLASS_HEALTHCHECK_TOKEN: 'health-token'
        });

        expect(options.healthUrl).to.equal('https://helios.example/healthz');
        expect(options.healthBearerToken).to.equal('health-token');
    });

    it('probes health and forwards the bearer token', async () => {
        let observedRequest = null;

        const probe = await probeBreakGlassHealth('https://helios.example/healthz', {
            expectedMode: 'offline',
            expectedEnabled: true,
            bearerToken: 'health-token',
            fetchImpl: async (url, options) => {
                observedRequest = { url, options };
                return {
                    status: 200,
                    text: async () => JSON.stringify({
                        ok: true,
                        detailsRestricted: false,
                        breakGlass: {
                            mode: 'offline',
                            enabled: true
                        }
                    })
                };
            }
        });

        expect(observedRequest.url).to.equal('https://helios.example/healthz');
        expect(observedRequest.options.headers).to.deep.equal({
            Authorization: 'Bearer health-token'
        });
        expect(probe.success).to.equal(true);
    });

    it('runs a successful break-glass drill with health verification', async () => {
        const executedCommands = [];
        const probes = [];

        const report = await runBreakGlassDrill({
            drillEnvironment: 'staging',
            activateCommand: 'activate-command',
            resetCommand: 'reset-command',
            validationCommand: 'validate-command',
            auditValidationCommand: 'audit-command',
            healthUrl: 'https://helios.example/healthz',
            targetMode: 'offline'
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
            probeBreakGlassHealthImpl: async (_url, options) => {
                probes.push({
                    expectedMode: options.expectedMode,
                    expectedEnabled: options.expectedEnabled
                });
                return {
                    executed: true,
                    skipped: false,
                    success: true,
                    statusCode: 200,
                    durationMs: 10,
                    detailsRestricted: false,
                    breakGlass: {
                        mode: options.expectedMode,
                        enabled: options.expectedEnabled
                    },
                    reason: 'Health check passed.'
                };
            }
        });

        expect(executedCommands).to.deep.equal([
            'activate-command',
            'validate-command',
            'audit-command',
            'reset-command'
        ]);
        expect(probes).to.deep.equal([
            { expectedMode: 'disabled', expectedEnabled: false },
            { expectedMode: 'offline', expectedEnabled: true },
            { expectedMode: 'disabled', expectedEnabled: false }
        ]);
        expect(report.success).to.equal(true);
    });

    it('skips later steps when activation fails', async () => {
        const report = await runBreakGlassDrill({
            activateCommand: 'activate-command',
            resetCommand: 'reset-command',
            targetMode: 'offline',
            healthUrl: 'https://helios.example/healthz'
        }, {
            executeCommandImpl: async () => ({
                success: false,
                exitCode: 1,
                durationMs: 20,
                timedOut: false,
                reason: 'Command exited with code 1.'
            }),
            probeBreakGlassHealthImpl: async () => ({
                executed: true,
                skipped: false,
                success: true,
                statusCode: 200,
                durationMs: 10,
                detailsRestricted: false,
                breakGlass: {
                    mode: 'disabled',
                    enabled: false
                },
                reason: 'Health check passed.'
            })
        });

        expect(report.success).to.equal(false);
        expect(report.failures).to.deep.equal([
            {
                step: 'activate',
                reason: 'Command exited with code 1.'
            }
        ]);
        expect(report.steps.reset).to.deep.equal({
            executed: false,
            skipped: true,
            success: null,
            reason: 'Skipped because the activation step failed.'
        });
    });

    it('writes the drill report to disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-break-glass-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'break-glass.json');
        const report = {
            success: true,
            summary: {
                executedSteps: 4
            }
        };

        const writtenPath = writeBreakGlassDrillReport(outputFile, report);
        const persisted = JSON.parse(fs.readFileSync(writtenPath, 'utf8'));

        expect(writtenPath).to.equal(path.resolve(outputFile));
        expect(persisted.summary.executedSteps).to.equal(4);
    });
});
