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
        expect(overview.prerequisites).to.have.length(5);
        expect(overview.scenarios[0].routes[0]).to.match(/^http:\/\/127\.0\.0\.1:3000\//);
        expect(overview.defaultScenarioId).to.equal('research-full-suite');
    });

    it('builds a playwright spec template for a valid scenario', () => {
        const script = playwrightResearchService.buildPlaywrightScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'research-full-suite'
        });

        expect(script.fileName).to.equal('playwright-research-full-suite.spec.js');
        expect(script.runtime).to.equal('@playwright/test');
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
});
