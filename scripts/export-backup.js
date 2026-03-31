const path = require('path');
const mongoose = require('mongoose');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { validateRuntimeConfig } = require('../src/config/runtimeConfig');
const { resolveBackupProtection } = require('../src/services/backupProtectionService');
const { exportBackupArchive, writeBackupArchive } = require('../src/services/continuityService');

const rootDir = path.join(__dirname, '..');
loadRuntimeEnvironment({ rootDir });
const runtimeConfig = validateRuntimeConfig();

function buildTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv = []) {
    const outPathArg = argv.find((value) => value.startsWith('--out='));
    const reasonArg = argv.find((value) => value.startsWith('--reason='));

    return {
        reason: reasonArg ? reasonArg.split('=').slice(1).join('=') : '',
        outPath: outPathArg
            ? path.resolve(rootDir, outPathArg.split('=').slice(1).join('='))
            : path.join(rootDir, 'artifacts', 'backups', `note-app-backup-${buildTimestamp()}.json`)
    };
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const backupProtection = resolveBackupProtection({
        env: process.env,
        runtimeConfig
    });

    await mongoose.connect(runtimeConfig.dbURI);

    try {
        const archive = await exportBackupArchive({
            metadata: {
                nodeEnv: process.env.NODE_ENV || '',
                reason: options.reason
            }
        });

        writeBackupArchive(options.outPath, archive, {
            protection: {
                rawSecret: backupProtection.rawSecret,
                cipherAlgo: backupProtection.cipherAlgo
            }
        });

        console.log(`[backup] Wrote backup archive to ${options.outPath}`);
        archive.summary.forEach((entry) => {
            console.log(`[backup] ${entry.label}: ${entry.count}`);
        });
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((error) => {
    console.error('[backup] Export failed:', error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
