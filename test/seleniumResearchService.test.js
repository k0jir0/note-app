const { expect } = require('chai');

const seleniumResearchService = require('../src/services/seleniumResearchService');

describe('Selenium research service', () => {
    it('builds module overview data with scenario coverage and prerequisites', () => {
        const overview = seleniumResearchService.buildSeleniumModuleOverview({
            baseUrl: 'http://127.0.0.1:3000/'
        });

        expect(overview.module.name).to.equal('Selenium Module');
        expect(overview.module.baseUrl).to.equal('http://127.0.0.1:3000');
        expect(overview.coverage.scenarioCount).to.equal(5);
        expect(overview.coverage.authenticatedScenarioCount).to.equal(5);
        expect(overview.prerequisites).to.have.length(5);
        expect(overview.scenarios[0].routes[0]).to.match(/^http:\/\/127\.0\.0\.1:3000\//);
        expect(overview.defaultScenarioId).to.equal('research-full-suite');
    });

    it('builds a selenium script template for a valid scenario', () => {
        const script = seleniumResearchService.buildSeleniumScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'research-full-suite'
        });

        expect(script.fileName).to.equal('selenium-research-full-suite.js');
        expect(script.runtime).to.equal('selenium-webdriver');
        expect(script.content).to.include('require(\'selenium-webdriver\')');
        expect(script.content).to.include('http://localhost:3000');
        expect(script.content).to.include('/security/module');
        expect(script.content).to.include('/selenium/module');
    });

    it('throws when an unknown scenario is requested', () => {
        expect(() => seleniumResearchService.buildSeleniumScript({
            baseUrl: 'http://localhost:3000',
            scenarioId: 'not-real'
        })).to.throw('Unknown Selenium scenario: not-real');
    });
});
