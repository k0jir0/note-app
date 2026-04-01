const path = require('path');

const DEFAULT_LOCATOR_REPAIR_STORAGE_ROOT = path.resolve(__dirname, '../../artifacts/locator-repair/users');

function sanitizeScopeToken(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'current-user';
}

function resolveLocatorRepairScopeToken(user = {}) {
    return sanitizeScopeToken(
        user && (user._id || user.id || user.email || user.name || user.username || '')
    );
}

function resolveUserScopedLocatorRepairPaths(user = {}, options = {}) {
    const scopeToken = resolveLocatorRepairScopeToken(user);
    const rootDir = options.rootDir && String(options.rootDir).trim()
        ? path.resolve(options.rootDir)
        : DEFAULT_LOCATOR_REPAIR_STORAGE_ROOT;
    const scopeDir = path.join(rootDir, scopeToken);

    return {
        scopeToken,
        rootDir,
        scopeDir,
        historyPath: path.join(scopeDir, 'history.json'),
        modelPath: path.join(scopeDir, 'model.json')
    };
}

module.exports = {
    DEFAULT_LOCATOR_REPAIR_STORAGE_ROOT,
    resolveLocatorRepairScopeToken,
    resolveUserScopedLocatorRepairPaths
};
