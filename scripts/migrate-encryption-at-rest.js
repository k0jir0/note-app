const path = require('path');
const mongoose = require('mongoose');

const { loadRuntimeEnvironment } = require('../src/config/runtimeEnv');
const { validateRuntimeConfig } = require('../src/config/runtimeConfig');
const Note = require('../src/models/Notes');
const User = require('../src/models/User');
const SecurityAlert = require('../src/models/SecurityAlert');
const ScanResult = require('../src/models/ScanResult');
const { ENCRYPTED_NOTE_FIELDS } = require('../src/utils/noteEncryption');

const rootDir = path.join(__dirname, '..');
loadRuntimeEnvironment({ rootDir });
validateRuntimeConfig();

function parseArgs(argv = []) {
    const args = new Set(argv);
    const batchSizeArg = argv.find((value) => value.startsWith('--batch-size='));
    const parsedBatchSize = batchSizeArg
        ? Number.parseInt(batchSizeArg.split('=')[1], 10)
        : 50;

    return {
        dryRun: args.has('--dry-run'),
        batchSize: Number.isInteger(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : 50
    };
}

function prepareNoteDocument(document) {
    ENCRYPTED_NOTE_FIELDS.forEach((fieldName) => {
        const currentValue = document.get(fieldName);
        if (typeof currentValue === 'string') {
            document.markModified(fieldName);
        }
    });
}

async function saveMigratedDocument(document, dryRun) {
    if (dryRun) {
        return;
    }

    await document.save({ timestamps: false, validateBeforeSave: true });
}

async function migrateModel({ Model, label, batchSize, dryRun, prepareDocument }) {
    let processed = 0;
    let migrated = 0;
    let lastId = null;
    let hasMoreDocuments = true;

    while (hasMoreDocuments) {
        const query = lastId
            ? { _id: { $gt: lastId } }
            : {};

        const documents = await Model.find(query)
            .sort({ _id: 1 })
            .limit(batchSize);

        if (!documents.length) {
            hasMoreDocuments = false;
            break;
        }

        for (const document of documents) {
            processed += 1;
            lastId = document._id;

            if (typeof prepareDocument === 'function') {
                prepareDocument(document);
            }

            await saveMigratedDocument(document, dryRun);
            migrated += 1;
        }

        console.log(`[migration] ${label}: processed ${processed}`);
    }

    return { label, processed, migrated };
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const mongoUri = process.env.MONGODB_URI;

    console.log(`[migration] Starting encryption-at-rest backfill${options.dryRun ? ' (dry run)' : ''} with batch size ${options.batchSize}`);

    await mongoose.connect(mongoUri);

    try {
        const summaries = [];

        summaries.push(await migrateModel({
            Model: Note,
            label: 'notes',
            batchSize: options.batchSize,
            dryRun: options.dryRun,
            prepareDocument: prepareNoteDocument
        }));

        summaries.push(await migrateModel({
            Model: User,
            label: 'users',
            batchSize: options.batchSize,
            dryRun: options.dryRun
        }));

        summaries.push(await migrateModel({
            Model: SecurityAlert,
            label: 'security-alerts',
            batchSize: options.batchSize,
            dryRun: options.dryRun
        }));

        summaries.push(await migrateModel({
            Model: ScanResult,
            label: 'scan-results',
            batchSize: options.batchSize,
            dryRun: options.dryRun
        }));

        const totalProcessed = summaries.reduce((sum, item) => sum + item.processed, 0);
        const totalMigrated = summaries.reduce((sum, item) => sum + item.migrated, 0);

        summaries.forEach((summary) => {
            console.log(`[migration] ${summary.label}: migrated ${summary.migrated} of ${summary.processed}`);
        });

        console.log(`[migration] Completed. Migrated ${totalMigrated} document(s) across ${totalProcessed} processed record(s).`);
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((error) => {
    console.error('[migration] Encryption-at-rest backfill failed:', error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
