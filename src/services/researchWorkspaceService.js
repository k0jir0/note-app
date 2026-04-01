const { buildAutomationSection } = require('../utils/automationViewModel');
const { listResearchModules } = require('../features/research/researchModuleCatalog');

function buildAutomationViewModel(runtimeConfig = {}) {
    const automation = runtimeConfig && runtimeConfig.automation ? runtimeConfig.automation : {};

    return {
        anyEnabled: Boolean((automation.logBatch && automation.logBatch.enabled)
            || (automation.scanBatch && automation.scanBatch.enabled)),
        enabledCount: Number(Boolean(automation.logBatch && automation.logBatch.enabled))
            + Number(Boolean(automation.scanBatch && automation.scanBatch.enabled)),
        logBatch: buildAutomationSection(automation.logBatch, {
            source: 'server-log-batch',
            intervalMs: 60000,
            dedupeWindowMs: 300000,
            maxReadBytes: 65536
        }),
        scanBatch: buildAutomationSection(automation.scanBatch, {
            source: 'scheduled-scan-import',
            intervalMs: 300000,
            dedupeWindowMs: 3600000
        })
    };
}

function buildResearchWorkspaceViewModel(runtimeConfig = {}) {
    const automation = buildAutomationViewModel(runtimeConfig);
    const modules = listResearchModules().map((module) => {
        if (module.id === 'security-operations') {
            return {
                ...module,
                badgeTone: automation.anyEnabled ? 'success' : 'secondary',
                badgeText: `${automation.enabledCount}/2 automation pollers active`
            };
        }

        return module;
    });

    return {
        automation,
        modules
    };
}

module.exports = {
    buildAutomationViewModel,
    buildResearchWorkspaceViewModel
};
