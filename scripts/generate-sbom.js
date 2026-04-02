const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'sbom');
const outputFile = path.join(outputDirectory, 'helios.cdx.json');
const SBOM_NPM_VERSION = '10.9.2';

function readPackageManifest(rootDir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    } catch {
        return null;
    }
}

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

function stabilizeSbom(rawSbom, stableSbom = null, { rootDir = projectRoot } = {}) {
    const parsedSbom = JSON.parse(rawSbom);
    const stableMetadata = stableSbom && stableSbom.metadata && typeof stableSbom.metadata === 'object'
        ? stableSbom.metadata
        : null;
    const packageManifest = readPackageManifest(rootDir);
    const packageName = packageManifest && typeof packageManifest.name === 'string'
        ? packageManifest.name.trim()
        : '';

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

    if (packageName
        && parsedSbom.metadata
        && parsedSbom.metadata.component
        && typeof parsedSbom.metadata.component === 'object') {
        parsedSbom.metadata.component.name = packageName;
    }

    return `${JSON.stringify(parsedSbom, null, 2)}\n`;
}

function buildStabilizedSbom({ rootDir = projectRoot, destination = outputFile, rawSbom = '' } = {}) {
    const stableSbom = readCommittedSbom({ rootDir, destination }) || readExistingSbom(destination);
    const resolvedRawSbom = typeof rawSbom === 'string' && rawSbom.trim()
        ? rawSbom
        : execSync(`npx --yes npm@${SBOM_NPM_VERSION} sbom --package-lock-only --sbom-format cyclonedx`, {
            cwd: rootDir,
            encoding: 'utf8'
        });

    return stabilizeSbom(resolvedRawSbom, stableSbom, { rootDir });
}

function isSbomCurrent({ rootDir = projectRoot, destination = outputFile, rawSbom = '' } = {}) {
    if (!fs.existsSync(destination)) {
        return false;
    }

    const expectedSbom = buildStabilizedSbom({
        rootDir,
        destination,
        rawSbom
    });
    const committedSbom = fs.readFileSync(destination, 'utf8');

    return committedSbom === expectedSbom;
}

function generateSbom({ rootDir = projectRoot, destination = outputFile, rawSbom = '' } = {}) {
    const destinationDirectory = path.dirname(destination);
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const stabilizedSbom = buildStabilizedSbom({
        rootDir,
        destination,
        rawSbom
    });

    fs.writeFileSync(destination, stabilizedSbom, 'utf8');
    return destination;
}

if (require.main === module) {
    const writtenFile = generateSbom();
    console.log(`SBOM written to ${path.relative(projectRoot, writtenFile)}`);
}

module.exports = {
    buildStabilizedSbom,
    generateSbom,
    isSbomCurrent,
    readCommittedSbom,
    readCommittedTimestamp,
    readExistingSbom,
    readExistingTimestamp,
    stabilizeSbom
};
