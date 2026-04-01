const fs = require('fs');
const path = require('path');

const DEFAULT_HISTORY_PATH = path.resolve(__dirname, '../../artifacts/locator-repair-history.json');
const ALLOWED_FEEDBACK_LABELS = ['accepted', 'rejected', 'healed'];

function resolveLocatorRepairHistoryPath(customPath) {
    if (customPath && String(customPath).trim()) {
        return path.resolve(customPath);
    }

    if (process.env.LOCATOR_REPAIR_HISTORY_PATH && process.env.LOCATOR_REPAIR_HISTORY_PATH.trim()) {
        return path.resolve(process.env.LOCATOR_REPAIR_HISTORY_PATH.trim());
    }

    return DEFAULT_HISTORY_PATH;
}

function buildEmptyHistory() {
    return {
        version: 1,
        updatedAt: null,
        entries: []
    };
}

function normalizeEntry(entry = {}) {
    const feedbackLabel = ALLOWED_FEEDBACK_LABELS.includes(entry.feedbackLabel)
        ? entry.feedbackLabel
        : 'accepted';
    const recordedAt = entry.recordedAt
        ? new Date(entry.recordedAt).toISOString()
        : new Date().toISOString();

    return {
        id: entry.id || `locator-repair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        recordedAt,
        feedbackLabel,
        verified: Boolean(entry.verified),
        framework: entry.framework ? String(entry.framework) : '',
        route: entry.route ? String(entry.route) : '',
        scenarioId: entry.scenarioId ? String(entry.scenarioId) : '',
        locatorFamily: entry.locatorFamily ? String(entry.locatorFamily) : '',
        selectedRank: Number.isFinite(Number(entry.selectedRank)) ? Number(entry.selectedRank) : 0,
        selectedFingerprint: entry.selectedFingerprint ? String(entry.selectedFingerprint) : '',
        request: {
            locator: entry.request && entry.request.locator ? String(entry.request.locator) : '',
            stepGoal: entry.request && entry.request.stepGoal ? String(entry.request.stepGoal) : '',
            htmlSnippet: entry.request && entry.request.htmlSnippet ? String(entry.request.htmlSnippet) : ''
        },
        selectedCandidate: entry.selectedCandidate && typeof entry.selectedCandidate === 'object'
            ? { ...entry.selectedCandidate }
            : {},
        primaryLocator: entry.primaryLocator && typeof entry.primaryLocator === 'object'
            ? { ...entry.primaryLocator }
            : {},
        heuristicScore: Number.isFinite(Number(entry.heuristicScore)) ? Number(entry.heuristicScore) : 0,
        modelScore: Number.isFinite(Number(entry.modelScore)) ? Number(entry.modelScore) : 0,
        hybridScore: Number.isFinite(Number(entry.hybridScore)) ? Number(entry.hybridScore) : 0,
        confidence: entry.confidence ? String(entry.confidence) : 'low',
        healDecision: entry.healDecision && typeof entry.healDecision === 'object'
            ? { ...entry.healDecision }
            : {},
        notes: entry.notes ? String(entry.notes) : ''
    };
}

function loadLocatorRepairHistory(options = {}) {
    const historyPath = resolveLocatorRepairHistoryPath(options.historyPath);
    if (!fs.existsSync(historyPath)) {
        return buildEmptyHistory();
    }

    try {
        const payload = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const entries = Array.isArray(payload.entries)
            ? payload.entries.map((entry) => normalizeEntry(entry))
            : [];

        return {
            version: Number(payload.version) || 1,
            updatedAt: payload.updatedAt ? String(payload.updatedAt) : null,
            entries
        };
    } catch (error) {
        console.warn('[locator-repair-history] failed to load repair history:', error.message);
        return buildEmptyHistory();
    }
}

function saveLocatorRepairHistory(history = buildEmptyHistory(), options = {}) {
    const historyPath = resolveLocatorRepairHistoryPath(options.historyPath);
    const entries = Array.isArray(history.entries)
        ? history.entries.map((entry) => normalizeEntry(entry))
        : [];
    const payload = {
        version: Number(history.version) || 1,
        updatedAt: new Date().toISOString(),
        entries
    };

    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return historyPath;
}

function appendLocatorRepairHistoryEntry(entry = {}, options = {}) {
    const history = loadLocatorRepairHistory(options);
    const normalizedEntry = normalizeEntry(entry);

    history.entries.unshift(normalizedEntry);
    history.updatedAt = normalizedEntry.recordedAt;

    saveLocatorRepairHistory(history, options);
    return normalizedEntry;
}

function summarizeLocatorRepairHistory(historyOrOptions = {}, maybeOptions = {}) {
    const history = Array.isArray(historyOrOptions.entries)
        ? historyOrOptions
        : loadLocatorRepairHistory(historyOrOptions);
    const options = Array.isArray(historyOrOptions.entries) ? maybeOptions : {};
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8;
    const strategyCounts = {};
    const frameworkCounts = {};

    history.entries.forEach((entry) => {
        const strategy = entry.primaryLocator && entry.primaryLocator.strategy
            ? entry.primaryLocator.strategy
            : 'unknown';
        strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;

        const framework = entry.framework || 'unknown';
        frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
    });

    return {
        totalEntries: history.entries.length,
        acceptedCount: history.entries.filter((entry) => entry.feedbackLabel === 'accepted').length,
        rejectedCount: history.entries.filter((entry) => entry.feedbackLabel === 'rejected').length,
        healedCount: history.entries.filter((entry) => entry.feedbackLabel === 'healed').length,
        verifiedCount: history.entries.filter((entry) => entry.verified).length,
        lastRecordedAt: history.entries[0] ? history.entries[0].recordedAt : null,
        topStrategies: Object.entries(strategyCounts)
            .map(([label, count]) => ({ label, count }))
            .sort((left, right) => right.count - left.count)
            .slice(0, 5),
        frameworkBreakdown: Object.entries(frameworkCounts)
            .map(([label, count]) => ({ label, count }))
            .sort((left, right) => right.count - left.count),
        recentEntries: history.entries.slice(0, Math.max(0, limit)).map((entry) => ({
            id: entry.id,
            recordedAt: entry.recordedAt,
            feedbackLabel: entry.feedbackLabel,
            verified: entry.verified,
            framework: entry.framework,
            route: entry.route,
            scenarioId: entry.scenarioId,
            locatorFamily: entry.locatorFamily,
            selectedRank: entry.selectedRank,
            primaryLocator: entry.primaryLocator,
            selectedCandidate: entry.selectedCandidate,
            confidence: entry.confidence,
            hybridScore: entry.hybridScore
        }))
    };
}

module.exports = {
    ALLOWED_FEEDBACK_LABELS,
    DEFAULT_HISTORY_PATH,
    appendLocatorRepairHistoryEntry,
    loadLocatorRepairHistory,
    resolveLocatorRepairHistoryPath,
    saveLocatorRepairHistory,
    summarizeLocatorRepairHistory
};
