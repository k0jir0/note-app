const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const mongoose = require('mongoose');
const { resolveAlertTriageModelPath } = require('../src/utils/alertTriageModel');
const { trainAndPersistAlertTriageModel } = require('../src/services/alertTriageTrainingService');

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        if (argument === '--synthetic-only') {
            options.syntheticOnly = true;
            return options;
        }

        const [rawKey, rawValue] = argument.split('=');
        const key = rawKey.replace(/^--/, '');
        const value = rawValue === undefined ? true : rawValue;

        switch (key) {
            case 'output':
                options.output = String(value);
                break;
            case 'synthetic-count':
                options.syntheticCount = Number.parseInt(value, 10);
                break;
            case 'min-real-count':
                options.minRealCount = Number.parseInt(value, 10);
                break;
            case 'max-real-count':
                options.maxRealCount = Number.parseInt(value, 10);
                break;
            case 'seed':
                options.seed = Number.parseInt(value, 10);
                break;
            default:
                break;
        }

        return options;
    }, {
        output: null,
        syntheticOnly: false,
        syntheticCount: 600,
        minRealCount: 150,
        maxRealCount: 5000,
        seed: 1337
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const modelPath = resolveAlertTriageModelPath(options.output);
    if (!options.syntheticOnly && !process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required to train from stored alerts');
    }

    if (!options.syntheticOnly) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const result = await trainAndPersistAlertTriageModel({
        mode: options.syntheticOnly ? 'bootstrap' : 'mixed',
        modelPath,
        syntheticCount: options.syntheticCount,
        minRealCount: options.minRealCount,
        maxRealCount: options.maxRealCount,
        seed: options.seed,
        rescoreStoredAlerts: !options.syntheticOnly
    });

    console.log(JSON.stringify({
        savedPath: result.savedPath,
        trainedAt: result.model.trainedAt,
        trainingSamples: result.model.trainingSamples,
        metrics: result.model.metrics,
        sources: result.sources,
        labels: result.labels,
        syntheticBootstrapped: result.syntheticBootstrapped,
        realExamples: result.realExamples,
        syntheticExamples: result.syntheticExamples,
        rescoredAlerts: result.rescoredAlerts
    }, null, 2));
}

main()
    .catch((error) => {
        console.error('[alert-triage-train] training failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });
