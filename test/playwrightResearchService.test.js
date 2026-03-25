const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const playwrightResearchService = require('../src/services/playwrightResearchService');

describe('Playwright research service', () => {
    it('builds module overview data with scenario coverage and prerequisites', () => {
        const overview = playwrightResearchService.buildPlaywrightModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/'
        });

        expect(overview.module.name).to.equal('Playwright Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.coverage.scenarioCount).to.equal(6);
        expect(overview.coverage.authenticatedScenarioCount).to.equal(6);
        expect(overview.controls).to.have.length(4);
        expect(overview.prerequisites).to.have.length(5);
        expect(overview.suite.implementedScenarioCount).to.equal(6);
        expect(overview.suite.latestRun).to.have.property('available');
        expect(overview.scenarios[0].routes[0]).to.match(/^http:\/\/127\.0\.0\.1:3000\//);
        expect(overview.scenarios[0].routeTargets[0].description).to.be.a('string').and.not.equal('');
        expect(overview.scenarios[0].assertionDetails[0].description).to.be.a('string').and.not.equal('');
        expect(overview.scenarios[0].tagDetails[0].description).to.be.a('string').and.not.equal('');
        expect(overview.defaultScenarioId).to.equal('research-full-suite');
    });

    it('builds a playwright spec template for a valid scenario', () => {
        const script = playwrightResearchService.buildPlaywrightScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'research-full-suite'
        });

        expect(script.fileName).to.equal('playwright-research-full-suite.spec.js');
        expect(script.runtime).to.equal('@playwright/test');
        expect(script.routeTargets).to.be.an('array').that.is.not.empty;
        expect(script.assertionDetails).to.be.an('array').that.is.not.empty;
        expect(script.usageNotes).to.have.length(3);
        expect(script.functionDescription).to.be.a('string').and.include('is a smoke path across');
        expect(script.content).to.include('require(\'@playwright/test\')');
        expect(script.content).to.include('http://localhost:3000');
        expect(script.content).to.include('/security/module');
        expect(script.content).to.include('/selenium/module');
        expect(script.content).to.include('/playwright/module');
    });

    it('throws when an unknown scenario is requested', () => {
        expect(() => playwrightResearchService.buildPlaywrightScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'not-real'
        })).to.throw('Unknown Playwright scenario: not-real');
    });

    it('summarizes the latest playwright JSON report by scenario and project', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-report-'));
        const reportPath = path.join(tempDir, 'playwright-results.json');

        fs.writeFileSync(reportPath, JSON.stringify({
            stats: {
                startTime: '2026-03-25T18:00:00.000Z',
                duration: 1200
            },
            suites: [
                {
                    specs: [
                        {
                            title: 'Research Workspace Navigation',
                            file: 'playwright-tests/research-scenarios.spec.js',
                            tests: [
                                {
                                    projectName: 'chromium',
                                    annotations: [
                                        {
                                            type: 'playwright-scenario',
                                            description: 'workspace-navigation'
                                        }
                                    ],
                                    results: [
                                        {
                                            status: 'passed',
                                            duration: 150
                                        }
                                    ]
                                },
                                {
                                    projectName: 'firefox',
                                    annotations: [
                                        {
                                            type: 'playwright-scenario',
                                            description: 'workspace-navigation'
                                        }
                                    ],
                                    results: [
                                        {
                                            status: 'failed',
                                            duration: 220
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }), 'utf8');

        const latestRun = playwrightResearchService.buildLatestRunSummary(reportPath);

        expect(latestRun.available).to.equal(true);
        expect(latestRun.status).to.equal('failed');
        expect(latestRun.total).to.equal(2);
        expect(latestRun.passed).to.equal(1);
        expect(latestRun.failed).to.equal(1);
        expect(latestRun.projects).to.have.length(2);
        expect(latestRun.scenarioResults[0].scenarioId).to.equal('workspace-navigation');
    });
});
