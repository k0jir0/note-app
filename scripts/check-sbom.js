#!/usr/bin/env node
const path = require('path');

const { isSbomCurrent } = require('./generate-sbom');

const projectRoot = path.join(__dirname, '..');
const destination = path.join(projectRoot, 'sbom', 'note-app.cdx.json');

if (!isSbomCurrent({ rootDir: projectRoot, destination })) {
    console.error('Committed SBOM is out of date. Run "npm run sbom:generate" and commit the updated sbom/note-app.cdx.json file.');
    process.exit(1);
}

console.log('Committed SBOM matches the current lockfile-derived dependency graph.');
