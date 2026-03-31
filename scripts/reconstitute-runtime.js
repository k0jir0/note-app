const path = require('path');
const mongoose = require('mongoose');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { validateRuntimeConfig } = require('../src/config/runtimeConfig');
const { collectReconstitutionStatus } = require('../src/services/continuityService');

const rootDir = path.join(__dirname, '..');
loadRuntimeEnvironment({ rootDir });
const runtimeConfig = validateRuntimeConfig();

function parseArgs(argv = []) {
    return {
        requireUsers: argv.includes('--require-users')
    };
}

async function run() {
    const options = parseArgs(process.argv.slice(2));

    await mongoose.connect(runtimeConfig.dbURI);

    try {
        const status = await collectReconstitutionStatus({
            runtimeConfig,
            requireUsers: options.requireUsers
        });

        console.log(`[reconstitute] Checked at ${status.checkedAt}`);
        console.log(`[reconstitute] Protected runtime: ${status.runtime.protectedRuntime}`);
        console.log(`[reconstitute] Secure transport required: ${status.runtime.secureTransportRequired}`);
        console.log(`[reconstitute] Immutable logging required: ${status.runtime.immutableLoggingRequired}`);
        Object.entries(status.collectionCounts).forEach(([id, count]) => {
            console.log(`[reconstitute] ${id}: ${count}`);
        });

        status.warnings.forEach((warning) => {
            console.warn(`[reconstitute] warning: ${warning}`);
        });

        if (!status.ready) {
            status.issues.forEach((issue) => {
                console.error(`[reconstitute] issue: ${issue}`);
            });
            process.exitCode = 1;
            return;
        }

        console.log('[reconstitute] Runtime continuity checks passed.');
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((error) => {
    console.error('[reconstitute] Runtime reconstitution check failed:', error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
