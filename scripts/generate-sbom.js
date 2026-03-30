const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'sbom');
const outputFile = path.join(outputDirectory, 'note-app.cdx.json');

fs.mkdirSync(outputDirectory, { recursive: true });

const sbom = execSync('npm sbom --package-lock-only --sbom-format cyclonedx', {
    cwd: projectRoot,
    encoding: 'utf8'
});

fs.writeFileSync(outputFile, sbom, 'utf8');
console.log(`SBOM written to ${path.relative(projectRoot, outputFile)}`);
