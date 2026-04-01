const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const { trainAndPersistLocatorRepairModel } = require('../src/services/locatorRepairResearchService');

function parseArgs(argv = []) {
    return argv.reduce((options, argument) => {
        const [rawKey, rawValue] = argument.split('=');
        const key = rawKey.replace(/^--/, '');
        const value = rawValue === undefined ? true : rawValue;

        switch (key) {
            case 'mode':
                options.mode = String(value);
                break;
            case 'output':
                options.output = String(value);
                break;
            case 'history':
                options.history = String(value);
                break;
            default:
                break;
        }

        return options;
    }, {
        mode: 'hybrid',
        output: null,
        history: null
    });
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const result = trainAndPersistLocatorRepairModel({
        mode: options.mode,
        modelPath: options.output,
        historyPath: options.history
    });

    console.log(JSON.stringify({
        savedPath: result.savedPath,
        mode: result.mode,
        bootstrapExamples: result.bootstrapExamples,
        historyExamples: result.historyExamples,
        feedbackEntries: result.feedbackEntries,
        labels: result.labels,
        model: result.model
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error('[locator-repair-train] training failed:', error.message);
    process.exitCode = 1;
}
