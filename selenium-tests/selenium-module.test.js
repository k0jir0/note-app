const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const { getSeleniumScenario, listSeleniumScenarios } = require('../src/lib/seleniumScenarioRegistry');
const { createAuthenticatedSession } = require('./helpers/auth');
const {
    clickElement,
    parseNumber,
    waitForBodyText,
    waitForElementText
} = require('./helpers/ui');
const { createDriver, getBaseUrl, waitForApp } = require('./helpers/webdriver');

async function openSeleniumModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/selenium/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Selenium Testing Module');
    await waitForBodyText(driver, 'Selenium Testing module ready.');
}

describe('Selenium module browser suite', function () {
    this.timeout(120000);

    const baseUrl = getBaseUrl();
    const expectedScenarioCount = listSeleniumScenarios().length;
    let driver;

    before(async () => {
        await waitForApp(baseUrl);
    });

    beforeEach(async () => {
        driver = await createDriver();
        await createAuthenticatedSession(driver, baseUrl);
    });

    afterEach(async () => {
        if (driver) {
            await driver.quit();
            driver = null;
        }
    });

    it(getSeleniumScenario('selenium-module-overview').title, async () => {
        await openSeleniumModule(driver, baseUrl);

        const scenarioCountText = await driver.findElement(By.id('selenium-scenario-count')).getText();
        expect(parseNumber(scenarioCountText)).to.equal(expectedScenarioCount);

        const implementedCountText = await driver.findElement(By.id('selenium-suite-implemented-count')).getText();
        expect(parseNumber(implementedCountText)).to.equal(expectedScenarioCount);

        const baseUrlText = await driver.findElement(By.id('selenium-base-url')).getText();
        expect(baseUrlText).to.equal(baseUrl);

        const latestRunStatusText = await driver.findElement(By.id('selenium-latest-run-status')).getText();
        expect(latestRunStatusText).to.not.equal('');

        await waitForElementText(
            driver,
            By.id('selenium-script-file-badge'),
            (text) => text.includes('.js')
        );

        const scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('selenium-webdriver');
        expect(scriptPreview).to.include('/selenium/module');
    });

    it(getSeleniumScenario('selenium-script-preview-updates').title, async () => {
        await openSeleniumModule(driver, baseUrl);

        await clickElement(driver, By.css('#selenium-scenario-select option[value="security-module-workflow"]'));
        await waitForBodyText(driver, 'Updated the Selenium script preview for the selected scenario.');

        let badgeText = await driver.findElement(By.id('selenium-script-file-badge')).getText();
        expect(badgeText).to.equal('selenium-security-module-workflow.js');

        let scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('/security/module');
        expect(scriptPreview).to.include('Security Operations Module');

        await clickElement(driver, By.css('#selenium-scenario-select option[value="research-full-suite"]'));
        await clickElement(driver, By.id('selenium-load-script-btn'));
        await waitForBodyText(driver, 'Loaded the selected Selenium script template.');

        badgeText = await driver.findElement(By.id('selenium-script-file-badge')).getText();
        expect(badgeText).to.equal('selenium-research-full-suite.js');

        scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('/playwright/module');
        expect(scriptPreview).to.include('/ml/module');
    });

    it(getSeleniumScenario('selenium-module-navigation').title, async () => {
        await openSeleniumModule(driver, baseUrl);

        await clickElement(driver, By.id('selenium-refresh-btn'));
        await waitForBodyText(driver, 'Selenium Testing module refreshed.');

        await clickElement(driver, By.css('a[href="/playwright/module"]'));
        await driver.wait(async () => {
            const currentUrl = await driver.getCurrentUrl();
            return currentUrl.includes('/playwright/module');
        }, 15000, 'Expected navigation to the Playwright module.');

        await waitForBodyText(driver, 'Playwright Testing Module');
    });
});
