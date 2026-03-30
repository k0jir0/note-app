const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const locatorRepairResearchService = require('../src/services/locatorRepairResearchService');

describe('Locator repair research service', () => {
    const tempModelPath = path.resolve(__dirname, '.tmp-locator-repair-model.json');
    const tempHistoryPath = path.resolve(__dirname, '.tmp-locator-repair-history.json');

    afterEach(() => {
        [tempModelPath, tempHistoryPath].forEach((filePath) => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    });

    it('builds module overview data with sample cases, model state, and repair guidance', () => {
        const overview = locatorRepairResearchService.buildLocatorRepairModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/',
            modelPath: tempModelPath,
            historyPath: tempHistoryPath
        });

        expect(overview.module.name).to.equal('Self-Healing Locator Repair Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.coverage.sampleCaseCount).to.equal(locatorRepairResearchService.getSampleCaseIds().length);
        expect(overview.coverage.supportedLocatorFamilyCount).to.be.greaterThan(0);
        expect(overview.controls).to.have.length(6);
        expect(overview.workflow).to.have.length(5);
        expect(overview.repairLadder).to.have.length(5);
        expect(overview.supportedSignals).to.have.length(8);
        expect(overview.defaultSampleId).to.equal(locatorRepairResearchService.DEFAULT_SAMPLE_ID);
        expect(overview.sampleCases[0].htmlSnippet).to.include('<');
        expect(overview.model.available).to.equal(true);
        expect(overview.history.totalEntries).to.equal(0);
    });

    it('suggests stable replacements for a text-driven workspace link drift', () => {
        const result = locatorRepairResearchService.suggestLocatorRepairs({
            locator: 'By.linkText("Open Alert Triage ML Module")',
            stepGoal: 'Open the Alert Triage ML Module from the Research Workspace',
            htmlSnippet: '<a href="/ml/module" data-testid="research-open-ml">Open Alert Triage ML Module</a>'
        });

        expect(result.analysis.locatorFamily).to.equal('selenium-link-text');
        expect(result.analysis.candidateCount).to.equal(1);
        expect(result.engine.model.available).to.equal(true);
        expect(result.suggestions[0].primaryLocator.strategy).to.equal('data-testid');
        expect(result.suggestions[0].primaryLocator.playwright).to.include('getByTestId');
        expect(result.suggestions[0].primaryLocator.selenium).to.include('By.css');
        expect(result.suggestions[0].reasons.join(' ')).to.include('step goal');
        expect(result.suggestions[0].ml.score).to.be.greaterThan(0);
    });

    it('suggests form-field repairs when the id drifts but semantic attributes remain', () => {
        const result = locatorRepairResearchService.suggestLocatorRepairs({
            locator: 'page.locator("#email")',
            stepGoal: 'Fill the login email field before submitting the form',
            htmlSnippet: '<input id="login-email-input" name="email" type="email" placeholder="Email address" data-testid="auth-email-input" />'
        });

        expect(result.analysis.locatorFamily).to.equal('playwright-css');
        expect(result.suggestions[0].primaryLocator.playwright).to.include('getByTestId');
        expect(result.suggestions[0].alternativeLocators.map((entry) => entry.strategy)).to.include('name');
        expect(result.suggestions[0].candidate.name).to.equal('email');
        expect(result.suggestions[0].candidate.fingerprint).to.be.a('string').and.not.equal('');
    });

    it('returns a deterministic fallback when no interactive candidate is found', () => {
        const result = locatorRepairResearchService.suggestLocatorRepairs({
            locator: 'page.getByText("Load Spec")',
            stepGoal: 'Reload the generated Playwright spec preview',
            htmlSnippet: '<div class="empty-state">No interactive controls are present here.</div>'
        });

        expect(result.analysis.candidateCount).to.equal(0);
        expect(result.suggestions[0].primaryLocator.strategy).to.equal('add-data-testid');
        expect(result.analysis.warnings.join(' ')).to.include('No interactive elements were detected');
    });

    it('records feedback, stores history, and persists a trained model', () => {
        const htmlSnippet = [
            '<div class="d-flex gap-2">',
            '    <a href="/security/module" data-testid="research-open-security">Open Security Operations Module</a>',
            '    <a href="/ml/module" data-testid="research-open-ml">Open Alert Triage ML Module</a>',
            '</div>'
        ].join('\n');
        const suggestionResult = locatorRepairResearchService.suggestLocatorRepairs({
            locator: 'By.linkText("Open Alert Triage ML Module")',
            stepGoal: 'Open the Alert Triage ML Module from the Research Workspace',
            htmlSnippet,
            modelPath: tempModelPath
        });

        const feedback = locatorRepairResearchService.recordLocatorRepairFeedback({
            locator: 'By.linkText("Open Alert Triage ML Module")',
            stepGoal: 'Open the Alert Triage ML Module from the Research Workspace',
            htmlSnippet,
            selectedFingerprint: suggestionResult.suggestions[0].candidate.fingerprint,
            feedbackLabel: 'accepted',
            framework: 'playwright',
            route: '/research',
            scenarioId: 'workspace-navigation',
            modelPath: tempModelPath,
            historyPath: tempHistoryPath
        });

        expect(fs.existsSync(tempModelPath)).to.equal(true);
        expect(fs.existsSync(tempHistoryPath)).to.equal(true);
        expect(feedback.history.summary.totalEntries).to.equal(1);
        expect(feedback.model.available).to.equal(true);
        expect(feedback.model.source).to.equal('persisted');
    });
});
