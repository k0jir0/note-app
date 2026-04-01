const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    checkItsg33Artifacts,
    requiredArtifacts
} = require('../scripts/check-itsg33-docs');

function writeFile(rootDir, relativePath, content = 'placeholder\n') {
    const absolutePath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
}

describe('ITSG-33 artifact checks', () => {
    it('accepts the required documentation and workflow artifacts', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'note-app-itsg33-'));

        requiredArtifacts.forEach((relativePath) => {
            writeFile(tempDirectory, relativePath);
        });

        writeFile(tempDirectory, 'docs/itsg33-review.md', 'See docs/itsg33-automation-analysis.md\n');
        writeFile(tempDirectory, '.github/pull_request_template.md', '## ITSG-33 Evidence\n');

        expect(checkItsg33Artifacts({ rootDir: tempDirectory })).to.have.length(requiredArtifacts.length);
    });

    it('rejects a missing automation analysis reference', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'note-app-itsg33-'));

        requiredArtifacts.forEach((relativePath) => {
            writeFile(tempDirectory, relativePath);
        });

        writeFile(tempDirectory, 'docs/itsg33-review.md', 'No automation reference here.\n');
        writeFile(tempDirectory, '.github/pull_request_template.md', '## ITSG-33 Evidence\n');

        expect(() => checkItsg33Artifacts({ rootDir: tempDirectory })).to.throw('docs/itsg33-review.md must reference docs/itsg33-automation-analysis.md.');
    });
});
