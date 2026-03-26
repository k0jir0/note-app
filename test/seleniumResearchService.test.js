const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const seleniumResearchService = require('../src/services/seleniumResearchService');

describe('Selenium research service', () => {
    it('builds module overview data with scenario coverage and prerequisites', () => {
        const scenarioCount = seleniumResearchService.getScenarioIds().length;
        const authenticatedScenarioCount = seleniumResearchService
            .buildSeleniumModuleOverview({ baseUrl: 'http://127.0.0.1:3000/' })
            .scenarios
            .filter((scenario) => scenario.requiresLogin)
            .length;
        const overview = seleniumResearchService.buildSeleniumModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/'
        });

        expect(overview.module.name).to.equal('Selenium Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.coverage.scenarioCount).to.equal(scenarioCount);
        expect(overview.coverage.authenticatedScenarioCount).to.equal(authenticatedScenarioCount);
        expect(overview.controls).to.have.length(4);
        expect(overview.prerequisites).to.have.length(5);
        expect(overview.suite.implementedScenarioCount).to.equal(scenarioCount);
        expect(overview.suite.latestRun).to.have.property('available');
        expect(overview.scenarios.find((scenario) => scenario.id === 'session-management-module-smoke')).to.exist;
        expect(overview.scenarios[0].routes[0]).to.match(/^http:\/\/127\.0\.0\.1:3000\//);
        expect(overview.scenarios[0].routeTargets[0].description).to.be.a('string').and.not.equal('');
        expect(overview.scenarios[0].assertionDetails[0].description).to.be.a('string').and.not.equal('');
        expect(overview.scenarios[0].tagDetails[0].description).to.be.a('string').and.not.equal('');
        expect(overview.defaultScenarioId).to.equal('research-full-suite');
    });

    it('builds a selenium script template for a valid scenario', () => {
        const script = seleniumResearchService.buildSeleniumScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'research-full-suite'
        });

        expect(script.fileName).to.equal('selenium-research-full-suite.js');
        expect(script.runtime).to.equal('selenium-webdriver');
        expect(script.routeTargets).to.be.an('array').that.is.not.empty;
        expect(script.assertionDetails).to.be.an('array').that.is.not.empty;
        expect(script.usageNotes).to.have.length(4);
        expect(script.functionDescription).to.be.a('string').and.include('is a Selenium smoke path across');
        expect(script.content).to.include('require(\'selenium-webdriver\')');
        expect(script.content).to.include('http://localhost:3000');
        expect(script.content).to.include('/security/module');
        expect(script.content).to.include('/selenium/module');
        expect(script.content).to.include('/playwright/module');
        expect(script.content).to.include('/self-healing/module');
        expect(script.content).to.include('/session-management/module');
        expect(script.content).to.include('/mission-assurance/module');
        expect(script.content).to.include('/hardware-mfa/module');
    });

    it('throws when an unknown scenario is requested', () => {
        expect(() => seleniumResearchService.buildSeleniumScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'not-real'
        })).to.throw('Unknown Selenium scenario: not-real');
    });

    it('summarizes the latest selenium JSON report by scenario and suite file', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'selenium-report-'));
        const reportPath = path.join(tempDir, 'selenium-results.json');

        fs.writeFileSync(reportPath, JSON.stringify({
            generatedAt: '2026-03-25T18:00:00.000Z',
            runtime: {
                browserName: 'edge',
                headless: true,
                baseUrl: 'http://localhost:3000'
            },
            stats: {
                durationMs: 1200
            },
            tests: [
                {
                    scenarioId: 'workspace-navigation',
                    title: 'Research Workspace Navigation',
                    file: 'selenium-tests/research-modules.test.js',
                    status: 'passed',
                    durationMs: 150
                },
                {
                    scenarioId: 'selenium-module-overview',
                    title: 'Selenium Module Overview',
                    file: 'selenium-tests/selenium-module.test.js',
                    status: 'failed',
                    durationMs: 220
                }
            ]
        }), 'utf8');

        const latestRun = seleniumResearchService.buildLatestRunSummary(reportPath);

        expect(latestRun.available).to.equal(true);
        expect(latestRun.status).to.equal('failed');
        expect(latestRun.total).to.equal(2);
        expect(latestRun.passed).to.equal(1);
        expect(latestRun.failed).to.equal(1);
        expect(latestRun.files).to.have.length(2);
        expect(latestRun.scenarioResults[0].scenarioId).to.equal('workspace-navigation');
    });
});
