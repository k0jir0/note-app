const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'sbom');
const outputFile = path.join(outputDirectory, 'note-app.cdx.json');
const SBOM_NPM_VERSION = '10.9.2';

function readSbomFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function readExistingTimestamp(filePath) {
    const existingSbom = readSbomFile(filePath);
    return existingSbom
        && existingSbom.metadata
        && typeof existingSbom.metadata.timestamp === 'string'
        ? existingSbom.metadata.timestamp
        : null;
}

function readExistingSbom(filePath) {
    return readSbomFile(filePath);
}

function readCommittedTimestamp({ rootDir, destination }) {
    const committedSbom = readCommittedSbom({ rootDir, destination });
    return committedSbom
        && committedSbom.metadata
        && typeof committedSbom.metadata.timestamp === 'string'
        ? committedSbom.metadata.timestamp
        : null;
}

function readCommittedSbom({ rootDir, destination }) {
    const relativeDestination = path.relative(rootDir, destination).replace(/\\/g, '/');

    try {
        return JSON.parse(execSync(`git show HEAD:${relativeDestination}`, {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }));
    } catch {
        return null;
    }
}

function stabilizeSbom(rawSbom, stableSbom = null) {
    const parsedSbom = JSON.parse(rawSbom);
    const stableMetadata = stableSbom && stableSbom.metadata && typeof stableSbom.metadata === 'object'
        ? stableSbom.metadata
        : null;

    if (stableSbom && typeof stableSbom.serialNumber === 'string') {
        parsedSbom.serialNumber = stableSbom.serialNumber;
    }

    if (stableMetadata && parsedSbom.metadata && typeof parsedSbom.metadata === 'object') {
        if (typeof stableMetadata.timestamp === 'string') {
            parsedSbom.metadata.timestamp = stableMetadata.timestamp;
        }

        if (Array.isArray(stableMetadata.tools)) {
            parsedSbom.metadata.tools = stableMetadata.tools;
        }
    }

    return `${JSON.stringify(parsedSbom, null, 2)}\n`;
}

function generateSbom({ rootDir = projectRoot, destination = outputFile } = {}) {
    const destinationDirectory = path.dirname(destination);
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const stableSbom = readCommittedSbom({ rootDir, destination }) || readExistingSbom(destination);
    const rawSbom = execSync(`npx --yes npm@${SBOM_NPM_VERSION} sbom --package-lock-only --sbom-format cyclonedx`, {
        cwd: rootDir,
        encoding: 'utf8'
    });
    const stabilizedSbom = stabilizeSbom(rawSbom, stableSbom);

    fs.writeFileSync(destination, stabilizedSbom, 'utf8');
    return destination;
}

if (require.main === module) {
    const writtenFile = generateSbom();
    console.log(`SBOM written to ${path.relative(projectRoot, writtenFile)}`);
}

module.exports = {
    generateSbom,
    readCommittedSbom,
    readCommittedTimestamp,
    readExistingSbom,
    readExistingTimestamp,
    stabilizeSbom
};
