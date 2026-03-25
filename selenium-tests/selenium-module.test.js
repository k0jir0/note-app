const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const seleniumResearchService = require('../src/services/seleniumResearchService');
const { createAuthenticatedSession } = require('./helpers/auth');
const {
    parseNumber,
    waitForBodyText,
    waitForElementText
} = require('./helpers/ui');
const { createDriver, getBaseUrl, waitForApp } = require('./helpers/webdriver');

async function openSeleniumModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/selenium/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Selenium Module');
    await waitForBodyText(driver, 'Selenium module ready.');
}

describe('Selenium module browser suite', function () {
    this.timeout(120000);

    const baseUrl = getBaseUrl();
    const expectedScenarioCount = seleniumResearchService.getScenarioIds().length;
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

    it('loads the live Selenium module overview from localhost and renders the generated script preview', async () => {
        await openSeleniumModule(driver, baseUrl);

        const scenarioCountText = await driver.findElement(By.id('selenium-scenario-count')).getText();
        expect(parseNumber(scenarioCountText)).to.equal(expectedScenarioCount);

        const baseUrlText = await driver.findElement(By.id('selenium-base-url')).getText();
        expect(baseUrlText).to.equal(baseUrl);

        await waitForElementText(
            driver,
            By.id('selenium-script-file-badge'),
            (text) => text.includes('.js')
        );

        const scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('selenium-webdriver');
        expect(scriptPreview).to.include('/selenium/module');
    });

    it('updates the script preview when a different Selenium scenario is selected and loaded', async () => {
        await openSeleniumModule(driver, baseUrl);

        await driver.findElement(By.css('#selenium-scenario-select option[value="security-module-smoke"]')).click();
        await waitForBodyText(driver, 'Updated the Selenium script preview for the selected scenario.');

        let badgeText = await driver.findElement(By.id('selenium-script-file-badge')).getText();
        expect(badgeText).to.equal('selenium-security-module-smoke.js');

        let scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('/security/module');
        expect(scriptPreview).to.include('Security Module');

        await driver.findElement(By.css('#selenium-scenario-select option[value="research-full-suite"]')).click();
        await driver.findElement(By.id('selenium-load-script-btn')).click();
        await waitForBodyText(driver, 'Loaded the selected Selenium script template.');

        badgeText = await driver.findElement(By.id('selenium-script-file-badge')).getText();
        expect(badgeText).to.equal('selenium-research-full-suite.js');

        scriptPreview = await driver.findElement(By.id('selenium-script-code')).getText();
        expect(scriptPreview).to.include('/playwright/module');
        expect(scriptPreview).to.include('/ml/module');
    });

    it('keeps Selenium module navigation and refresh controls working against the local app', async () => {
        await openSeleniumModule(driver, baseUrl);

        await driver.findElement(By.id('selenium-refresh-btn')).click();
        await waitForBodyText(driver, 'Selenium module refreshed.');

        await driver.findElement(By.css('a[href="/playwright/module"]')).click();
        await driver.wait(async () => {
            const currentUrl = await driver.getCurrentUrl();
            return currentUrl.includes('/playwright/module');
        }, 15000, 'Expected navigation to the Playwright module.');

        await waitForBodyText(driver, 'Playwright Module');
    });
});
