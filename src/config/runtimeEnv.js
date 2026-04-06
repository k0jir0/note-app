const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function captureProtectedEnvKeys(env = process.env) {
    return new Set(Object.keys(env || {}));
}

function applyEnvEntries(entries = {}, protectedEnvKeys = new Set()) {
    Object.entries(entries).forEach(([key, value]) => {
        if (protectedEnvKeys.has(key)) {
            return;
        }

        process.env[key] = value;
    });
}

function loadRuntimeEnvironment({ rootDir = process.cwd(), protectedEnvKeys = captureProtectedEnvKeys() } = {}) {
    dotenv.config({ path: path.join(rootDir, '.env') });

    const localEnvOverrides = readEnvFile(path.join(rootDir, '.env.local'));
    applyEnvEntries(localEnvOverrides, protectedEnvKeys);

    return {
        localEnvOverrides,
        protectedEnvKeys
    };
}

function reapplyLocalEnvOverrides(localEnvOverrides = {}, protectedEnvKeys = new Set()) {
    applyEnvEntries(localEnvOverrides, protectedEnvKeys);
}

module.exports = {
    captureProtectedEnvKeys,
    loadRuntimeEnvironment,
    reapplyLocalEnvOverrides
};
