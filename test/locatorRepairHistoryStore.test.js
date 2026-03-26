const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const {
    appendLocatorRepairHistoryEntry,
    loadLocatorRepairHistory,
    summarizeLocatorRepairHistory
} = require('../src/utils/locatorRepairHistoryStore');

describe('Locator repair history store', () => {
    const tempHistoryPath = path.resolve(__dirname, '.tmp-direct-locator-repair-history.json');

    afterEach(() => {
        if (fs.existsSync(tempHistoryPath)) {
            fs.unlinkSync(tempHistoryPath);
        }
    });

    it('appends repair history entries and summarizes outcomes', () => {
        appendLocatorRepairHistoryEntry({
            feedbackLabel: 'accepted',
            framework: 'playwright',
            route: '/research',
            selectedFingerprint: 'candidate-1',
            primaryLocator: {
                strategy: 'data-testid'
            },
            request: {
                locator: 'By.linkText("Open ML Module")',
                stepGoal: 'Open the ML Module',
                htmlSnippet: '<a data-testid="research-open-ml">Open ML Workspace</a>'
            }
        }, {
            historyPath: tempHistoryPath
        });
        appendLocatorRepairHistoryEntry({
            feedbackLabel: 'healed',
            verified: true,
            framework: 'selenium',
            route: '/selenium/module',
            selectedFingerprint: 'candidate-2',
            primaryLocator: {
                strategy: 'id'
            },
            request: {
                locator: 'By.id("missing-id")',
                stepGoal: 'Open the Selenium Module',
                htmlSnippet: '<button id="selenium-load-script-btn">Load Script</button>'
            }
        }, {
            historyPath: tempHistoryPath
        });

        const history = loadLocatorRepairHistory({ historyPath: tempHistoryPath });
        const summary = summarizeLocatorRepairHistory(history, { limit: 5 });

        expect(history.entries).to.have.length(2);
        expect(summary.totalEntries).to.equal(2);
        expect(summary.acceptedCount).to.equal(1);
        expect(summary.healedCount).to.equal(1);
        expect(summary.verifiedCount).to.equal(1);
        expect(summary.topStrategies[0].label).to.equal('id');
    });
});
