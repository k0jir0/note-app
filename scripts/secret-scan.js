#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getStagedFiles() {
    try {
        const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
        return out.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (err) {
        console.error('Unable to get staged files:', err.message);
        return [];
    }
}

const patterns = [
    { name: 'MONGODB_URI', re: /MONGODB_URI\s*=\/\/|MONGODB_URI\s*=|mongodb\+srv:\/\//i },
    { name: 'NOTE_ENCRYPTION_KEY', re: /NOTE_ENCRYPTION_KEY\s*=\s*[A-Fa-f0-9]{32,64}|NOTE_ENCRYPTION_KEY\s*=\s*[A-Za-z0-9+/=]{32,}/ },
    { name: 'SESSION_SECRET', re: /SESSION_SECRET\s*=/i },
    { name: 'PRIVATE_KEY', re: /-----BEGIN (RSA |)PRIVATE KEY-----/i },
    { name: 'LEGACY_NOTE_ENCRYPTION_KEY', re: /LEGACY_NOTE_ENCRYPTION_KEY\s*=/i }
];

const staged = getStagedFiles();
let found = [];

for (const rel of staged) {
    const full = path.resolve(rel);
    if (!fs.existsSync(full)) continue;
    try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const content = fs.readFileSync(full, 'utf8');
        for (const p of patterns) {
            if (p.re.test(content)) {
                found.push({ file: rel, pattern: p.name });
            }
        }
    } catch (err) {
    // skip binary or unreadable files
    }
}

if (found.length > 0) {
    console.error('\nSecret-scan failed: potential secret patterns found in staged files:');
    for (const f of found) console.error(` - ${f.file}: ${f.pattern}`);
    console.error('\nIf these are false positives, adjust the scanner or remove the sensitive content from the commit.');
    process.exit(1);
}

process.exit(0);
