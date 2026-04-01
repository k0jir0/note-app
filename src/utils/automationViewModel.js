function buildAutomationSection(config, defaults) {
    if (!config || !config.enabled) {
        return {
            enabled: false,
            statusLabel: 'Disabled',
            statusTone: 'secondary',
            source: defaults.source,
            intervalMs: defaults.intervalMs,
            dedupeWindowMs: defaults.dedupeWindowMs,
            filePath: null,
            maxReadBytes: defaults.maxReadBytes || null
        };
    }

    return {
        enabled: true,
        statusLabel: 'Active',
        statusTone: 'success',
        source: config.source,
        intervalMs: config.intervalMs,
        dedupeWindowMs: config.dedupeWindowMs,
        filePath: config.filePath,
        maxReadBytes: config.maxReadBytes || null
    };
}

module.exports = {
    buildAutomationSection
};
