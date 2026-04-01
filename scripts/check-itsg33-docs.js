#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

const requiredArtifacts = [
    'docs/itsg33-review.md',
    'docs/itsg33-control-matrix.md',
    'docs/itsg33-evidence-checklist.md',
    'docs/itsg33-operations-runbook.md',
    'docs/itsg33-automation-analysis.md',
    'scripts/refresh-k8s-support-image-digests.js',
    '.github/dependabot.yml',
    '.github/pull_request_template.md',
    '.github/ISSUE_TEMPLATE/monthly-security-review.yml',
    '.github/ISSUE_TEMPLATE/backup-restore-exercise.yml',
    '.github/ISSUE_TEMPLATE/break-glass-drill.yml',
    '.github/ISSUE_TEMPLATE/privileged-access-review.yml',
    '.github/ISSUE_TEMPLATE/annual-governance-refresh.yml',
    '.github/workflows/itsg33-release-evidence.yml',
    '.github/workflows/itsg33-monthly-review.yml',
    '.github/workflows/itsg33-quarterly-review.yml',
    '.github/workflows/itsg33-annual-review.yml',
    '.github/workflows/itsg33-k8s-digest-refresh.yml'
];

function checkItsg33Artifacts({ rootDir = projectRoot } = {}) {
    const missing = requiredArtifacts.filter((relativePath) => !fs.existsSync(path.join(rootDir, relativePath)));

    if (missing.length) {
        throw new Error(`Missing required ITSG-33 artifacts: ${missing.join(', ')}`);
    }

    const reviewText = fs.readFileSync(path.join(rootDir, 'docs', 'itsg33-review.md'), 'utf8');
    const prTemplateText = fs.readFileSync(path.join(rootDir, '.github', 'pull_request_template.md'), 'utf8');

    if (!reviewText.includes('docs/itsg33-automation-analysis.md')) {
        throw new Error('docs/itsg33-review.md must reference docs/itsg33-automation-analysis.md.');
    }

    if (!prTemplateText.includes('## ITSG-33 Evidence')) {
        throw new Error('.github/pull_request_template.md must include an ITSG-33 Evidence section.');
    }

    return requiredArtifacts.slice();
}

if (require.main === module) {
    const validated = checkItsg33Artifacts();
    console.log(`Validated ${validated.length} ITSG-33 documentation and workflow artifacts.`);
}

module.exports = {
    checkItsg33Artifacts,
    requiredArtifacts
};
