const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'sbom');
const outputFile = path.join(outputDirectory, 'note-app.cdx.json');

function readExistingTimestamp(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const existingSbom = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return existingSbom
            && existingSbom.metadata
            && typeof existingSbom.metadata.timestamp === 'string'
            ? existingSbom.metadata.timestamp
            : null;
    } catch {
        return null;
    }
}

function readCommittedTimestamp({ rootDir, destination }) {
    const relativeDestination = path.relative(rootDir, destination).replace(/\\/g, '/');

    try {
        const committedSbom = execSync(`git show HEAD:${relativeDestination}`, {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const parsedSbom = JSON.parse(committedSbom);
        return parsedSbom
            && parsedSbom.metadata
            && typeof parsedSbom.metadata.timestamp === 'string'
            ? parsedSbom.metadata.timestamp
            : null;
    } catch {
        return null;
    }
}

function stabilizeSbom(rawSbom, existingTimestamp) {
    const parsedSbom = JSON.parse(rawSbom);

    if (existingTimestamp && parsedSbom.metadata && typeof parsedSbom.metadata === 'object') {
        parsedSbom.metadata.timestamp = existingTimestamp;
    }

    return `${JSON.stringify(parsedSbom, null, 2)}\n`;
}

function generateSbom({ rootDir = projectRoot, destination = outputFile } = {}) {
    const destinationDirectory = path.dirname(destination);
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const existingTimestamp = readCommittedTimestamp({ rootDir, destination }) || readExistingTimestamp(destination);
    const rawSbom = execSync('npm sbom --package-lock-only --sbom-format cyclonedx', {
        cwd: rootDir,
        encoding: 'utf8'
    });
    const stabilizedSbom = stabilizeSbom(rawSbom, existingTimestamp);

    fs.writeFileSync(destination, stabilizedSbom, 'utf8');
    return destination;
}

if (require.main === module) {
    const writtenFile = generateSbom();
    console.log(`SBOM written to ${path.relative(projectRoot, writtenFile)}`);
}

module.exports = {
    generateSbom,
    readCommittedTimestamp,
    readExistingTimestamp,
    stabilizeSbom
};
