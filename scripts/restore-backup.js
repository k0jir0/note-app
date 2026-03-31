const path = require('path');
const mongoose = require('mongoose');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { validateRuntimeConfig } = require('../src/config/runtimeConfig');
const { readBackupArchive, restoreBackupArchive } = require('../src/services/continuityService');

const rootDir = path.join(__dirname, '..');
loadRuntimeEnvironment({ rootDir });
const runtimeConfig = validateRuntimeConfig();

function parseArgs(argv = []) {
    const inputArg = argv.find((value) => value.startsWith('--in='));
    return {
        inputPath: inputArg ? path.resolve(rootDir, inputArg.split('=').slice(1).join('=')) : '',
        dryRun: argv.includes('--dry-run'),
        confirmRestore: argv.includes('--confirm-restore')
    };
}

async function run() {
    const options = parseArgs(process.argv.slice(2));

    if (!options.inputPath) {
        throw new Error('Provide a backup archive with --in=<path-to-backup.json.gz>');
    }

    if (!options.dryRun && !options.confirmRestore) {
        throw new Error('Restoring data is destructive. Re-run with --confirm-restore or use --dry-run first.');
    }

    const archive = readBackupArchive(options.inputPath);

    await mongoose.connect(runtimeConfig.dbURI);

    try {
        const summary = await restoreBackupArchive({
            backupArchive: archive,
            dryRun: options.dryRun
        });

        console.log(`[restore] ${options.dryRun ? 'Validated' : 'Restored'} archive ${options.inputPath}`);
        summary.forEach((entry) => {
            console.log(`[restore] ${entry.label}: ${entry.restoredCount}`);
        });
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((error) => {
    console.error('[restore] Backup restore failed:', error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
