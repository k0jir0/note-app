const fs = require('fs');
const path = require('path');

const artifactCache = new Map();

function buildFileVersion(fileStats) {
    return `${fileStats.mtimeMs}:${fileStats.size}`;
}

function readCachedJsonArtifact(reportPath) {
    const resolvedPath = path.resolve(reportPath);

    if (!fs.existsSync(resolvedPath)) {
        artifactCache.delete(resolvedPath);
        return {
            exists: false,
            report: null,
            fileStats: null,
            error: null
        };
    }

    try {
        const fileStats = fs.statSync(resolvedPath);
        const version = buildFileVersion(fileStats);
        const cached = artifactCache.get(resolvedPath);

        if (cached && cached.version === version) {
            return cached.value;
        }

        const value = {
            exists: true,
            report: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')),
            fileStats,
            error: null
        };

        artifactCache.set(resolvedPath, {
            version,
            value
        });

        return value;
    } catch (error) {
        let fileStats = null;
        let version = `error:${resolvedPath}`;

        try {
            fileStats = fs.statSync(resolvedPath);
            version = buildFileVersion(fileStats);
        } catch (_statError) {
            artifactCache.delete(resolvedPath);
            return {
                exists: false,
                report: null,
                fileStats: null,
                error
            };
        }

        const value = {
            exists: true,
            report: null,
            fileStats,
            error
        };

        artifactCache.set(resolvedPath, {
            version,
            value
        });

        return value;
    }
}

module.exports = {
    readCachedJsonArtifact
};
