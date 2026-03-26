const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function applyEnvEntries(entries = {}) {
    Object.entries(entries).forEach(([key, value]) => {
        process.env[key] = value;
    });
}

function loadRuntimeEnvironment({ rootDir = process.cwd() } = {}) {
    dotenv.config({ path: path.join(rootDir, '.env') });

    const localEnvOverrides = readEnvFile(path.join(rootDir, '.env.local'));
    applyEnvEntries(localEnvOverrides);

    return {
        localEnvOverrides
    };
}

function reapplyLocalEnvOverrides(localEnvOverrides = {}) {
    applyEnvEntries(localEnvOverrides);
}

module.exports = {
    loadRuntimeEnvironment,
    reapplyLocalEnvOverrides
};
