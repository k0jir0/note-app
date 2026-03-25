const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

const {
    listSeleniumScenarios
} = require('../src/lib/seleniumScenarioRegistry');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT_DIR, 'selenium-tests');
const REPORT_PATH = path.join(ROOT_DIR, 'artifacts', 'selenium-results.json');
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_BASE_URL = 'http://localhost:3000';

function normalizePath(filePath) {
    return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function collectTestFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return [];
    }

    return fs.readdirSync(dirPath, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                return collectTestFiles(entryPath);
            }

            return entry.isFile() && entry.name.endsWith('.test.js')
                ? [entryPath]
                : [];
        })
        .sort((left, right) => left.localeCompare(right));
}

function normalizeStatus(status) {
    if (status === 'passed' || status === 'failed' || status === 'skipped') {
        return status;
    }

    return 'unknown';
}

function buildScenarioTitleIndex() {
    return new Map(
        listSeleniumScenarios().map((scenario) => [scenario.title, scenario.id])
    );
}

function ensureArtifactsDir() {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

function writeReport(payload) {
    ensureArtifactsDir();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function summarizeCounts(results) {
    return results.reduce((summary, result) => {
        summary.tests += 1;

        if (result.status === 'passed') {
            summary.passes += 1;
        } else if (result.status === 'failed') {
            summary.failures += 1;
        } else if (result.status === 'skipped') {
            summary.pending += 1;
        }

        return summary;
    }, {
        tests: 0,
        passes: 0,
        failures: 0,
        pending: 0
    });
}

async function run() {
    const testFiles = collectTestFiles(TEST_DIR);
    const timeoutMs = Number.parseInt(process.env.SELENIUM_TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS;
    const scenarioTitleIndex = buildScenarioTitleIndex();

    if (!testFiles.length) {
        console.error('No Selenium test files were found.');
        process.exitCode = 1;
        return;
    }

    const mocha = new Mocha({
        timeout: timeoutMs,
        reporter: 'spec'
    });

    testFiles.forEach((testFile) => {
        mocha.addFile(testFile);
    });

    await mocha.loadFilesAsync();

    const startedAt = new Date();
    const results = [];

    const runner = mocha.run((failures) => {
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const counts = summarizeCounts(results);
        const report = {
            generatedAt: finishedAt.toISOString(),
            sourcePath: 'artifacts/selenium-results.json',
            runtime: {
                browserName: String(process.env.SELENIUM_BROWSER || 'edge').trim().toLowerCase(),
                headless: process.env.SELENIUM_HEADLESS !== '0',
                baseUrl: (process.env.SELENIUM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
            },
            stats: {
                tests: counts.tests,
                passes: counts.passes,
                failures: counts.failures,
                pending: counts.pending,
                durationMs,
                startTime: startedAt.toISOString(),
                endTime: finishedAt.toISOString()
            },
            files: testFiles.map((testFile) => normalizePath(testFile)),
            tests: results
        };

        writeReport(report);

        console.log('');
        console.log(`Selenium JSON report written to artifacts/selenium-results.json`);
        console.log(`Summary: ${counts.passes} passed, ${counts.failures} failed, ${counts.pending} skipped in ${durationMs} ms.`);

        process.exitCode = failures ? 1 : 0;
    });

    const recordResult = (status, test, error) => {
        results.push({
            scenarioId: scenarioTitleIndex.get(test.title) || '',
            title: test.title,
            fullTitle: typeof test.fullTitle === 'function' ? test.fullTitle() : test.title,
            file: test.file ? normalizePath(test.file) : '',
            status: normalizeStatus(status),
            durationMs: typeof test.duration === 'number' ? test.duration : 0,
            err: error
                ? {
                    message: error.message || String(error),
                    stack: error.stack || ''
                }
                : null
        });
    };

    runner.on('pass', (test) => {
        recordResult('passed', test);
    });

    runner.on('fail', (test, error) => {
        recordResult('failed', test, error);
    });

    runner.on('pending', (test) => {
        recordResult('skipped', test);
    });
}

run().catch((error) => {
    console.error('Unable to run the Selenium suite:', error);
    process.exitCode = 1;
});
