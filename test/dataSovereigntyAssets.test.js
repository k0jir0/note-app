const fs = require('fs');
const path = require('path');

const { expect } = require('chai');

const viewsRoot = path.join(__dirname, '..', 'src', 'views');
const publicRoot = path.join(viewsRoot, 'public');
const headAssetsPartialPath = path.join(viewsRoot, 'partials', 'head-assets.ejs');

function walkFiles(rootDir, allowedExtensions) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    return entries.flatMap((entry) => {
        const absolutePath = path.join(rootDir, entry.name);

        if (entry.isDirectory()) {
            return walkFiles(absolutePath, allowedExtensions);
        }

        return allowedExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
    });
}

describe('Data sovereignty asset posture', () => {
    it('self-hosts shared frontend assets from local paths', () => {
        const headAssetsPartial = fs.readFileSync(headAssetsPartialPath, 'utf8');

        expect(headAssetsPartial).to.include('/vendor/bootstrap/css/bootstrap.min.css');
        expect(headAssetsPartial).to.include('/vendor/bootstrap-icons/font/bootstrap-icons.css');
        expect(headAssetsPartial).to.include('/css/styles.css');
        expect(headAssetsPartial).to.include('/css/custom.css');
        expect(headAssetsPartial).to.not.match(/(?:https?:)?\/\//i);
    });

    it('does not embed external asset URLs or inline style allowances in views and client assets', () => {
        const filesToCheck = [
            ...walkFiles(viewsRoot, new Set(['.ejs'])),
            ...walkFiles(publicRoot, new Set(['.js', '.css']))
        ];

        const disallowedPatterns = [
            {
                regex: /<(?:script|link|img)\b[^>]+\b(?:src|href)=['"](?:https?:)?\/\//i,
                message: 'external asset tag'
            },
            {
                regex: /url\(\s*['"]?(?:https?:)?\/\//i,
                message: 'external CSS url()'
            },
            {
                regex: /\b(?:fetch|EventSource|WebSocket)\(\s*['"]https?:\/\//i,
                message: 'external client network call'
            },
            {
                regex: /<style\b/i,
                message: 'inline style tag'
            },
            {
                regex: /\sstyle=/i,
                message: 'inline style attribute'
            }
        ];

        const violations = [];

        for (const filePath of filesToCheck) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(path.join(__dirname, '..'), filePath);

            for (const rule of disallowedPatterns) {
                if (rule.regex.test(content)) {
                    violations.push(`${relativePath}: ${rule.message}`);
                }
            }
        }

        expect(violations).to.deep.equal([]);
    });
});