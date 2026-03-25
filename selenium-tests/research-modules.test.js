const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const { createAuthenticatedSession, waitForLocationContains } = require('./helpers/auth');
const {
    clickElement,
    waitForBodyText,
    waitForElementText,
    waitForElementValue,
    waitForNumericText
} = require('./helpers/ui');
const { createDriver, getBaseUrl, waitForApp } = require('./helpers/webdriver');

async function openResearchWorkspace(driver, baseUrl) {
    await driver.get(`${baseUrl}/research`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Research Workspace');
}

async function openSecurityModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/security/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Security Module');
    await waitForElementText(
        driver,
        By.id('workspace-status'),
        (text) => /Workspace loaded(\.| with partial data\.)/.test(text),
        20000,
        'Expected the Security Module to finish loading.'
    );
}

async function openMlModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/ml/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'ML Module');
    await waitForElementText(
        driver,
        By.id('ml-status'),
        (text) => text.includes('ML module ready.'),
        20000,
        'Expected the ML Module to finish loading.'
    );
}

describe('Research module browser coverage', function () {
    this.timeout(120000);

    const baseUrl = getBaseUrl();
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

    it('navigates from the Research Workspace into each module entry point', async () => {
        await openResearchWorkspace(driver, baseUrl);
        await waitForBodyText(driver, 'Security Module');
        await waitForBodyText(driver, 'ML Module');
        await waitForBodyText(driver, 'Selenium Module');
        await waitForBodyText(driver, 'Playwright Module');

        await clickElement(driver, By.linkText('Open Security Module'));
        await waitForLocationContains(driver, '/security/module');
        await waitForBodyText(driver, 'Security Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open ML Module'));
        await waitForLocationContains(driver, '/ml/module');
        await waitForBodyText(driver, 'ML Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Selenium Module'));
        await waitForLocationContains(driver, '/selenium/module');
        await waitForBodyText(driver, 'Selenium Module');
        await waitForElementText(
            driver,
            By.id('selenium-status'),
            (text) => text.includes('Selenium module ready.'),
            20000,
            'Expected the Selenium Module to finish loading.'
        );

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Playwright Module'));
        await waitForLocationContains(driver, '/playwright/module');
        await waitForBodyText(driver, 'Playwright Module');
        await waitForElementText(
            driver,
            By.id('playwright-status'),
            (text) => text.includes('Playwright module ready.'),
            20000,
            'Expected the Playwright Module to finish loading.'
        );
    });

    it('runs the Security Module workflow with sample logs, scans, and correlations', async () => {
        await openSecurityModule(driver, baseUrl);

        await clickElement(driver, By.id('workspace-load-sample-log'));
        await waitForElementValue(
            driver,
            By.id('workspace-log-text'),
            (value) => value.includes('POST /auth/login 401'),
            15000,
            'Expected the sample log text to be loaded.'
        );
        await waitForElementText(
            driver,
            By.id('workspace-log-result'),
            (text) => text.includes('Sample log loaded.'),
            15000
        );

        await clickElement(driver, By.css('#workspace-log-form button[type="submit"]'));
        await waitForElementText(
            driver,
            By.id('workspace-log-result'),
            (text) => /\d+ alert\(s\) created from 16 lines\./.test(text),
            20000
        );
        await waitForNumericText(driver, By.id('workspace-alert-count'), (count) => count > 0, 20000);
        await driver.wait(async () => {
            const cards = await driver.findElements(By.css('#workspace-alerts-grid .security-alert-card'));
            return cards.length > 0;
        }, 15000, 'Expected at least one alert card to render.');

        const importantButtons = await driver.findElements(By.css('#workspace-alerts-grid [data-alert-feedback="important"]'));
        expect(importantButtons.length).to.be.greaterThan(0);
        await driver.executeScript(
            'arguments[0].scrollIntoView({ block: "center", inline: "center" });',
            importantButtons[0]
        );
        await driver.executeScript('arguments[0].click();', importantButtons[0]);
        await waitForElementText(
            driver,
            By.id('workspace-status'),
            (text) => text.includes('Alert feedback updated: Important.'),
            20000
        );

        await clickElement(driver, By.id('workspace-load-sample-scan'));
        await waitForElementValue(
            driver,
            By.id('workspace-scan-text'),
            (value) => value.includes('Nikto v2.1.6'),
            15000,
            'Expected the sample scan text to be loaded.'
        );
        await waitForElementText(
            driver,
            By.id('workspace-scan-result'),
            (text) => text.includes('Sample scan loaded.'),
            15000
        );

        await clickElement(driver, By.css('#workspace-scan-form button[type="submit"]'));
        await waitForElementText(
            driver,
            By.id('workspace-scan-result'),
            (text) => /Scan imported with \d+ finding\(s\)\./.test(text),
            20000
        );
        await waitForNumericText(driver, By.id('workspace-scan-count'), (count) => count > 0, 20000);
        await driver.wait(async () => {
            const cards = await driver.findElements(By.css('#workspace-scans-grid .scan-result-card'));
            return cards.length > 0;
        }, 15000, 'Expected at least one scan card to render.');

        await clickElement(driver, By.id('workspace-inject-correlation-demo'));
        await waitForElementText(
            driver,
            By.id('workspace-correlation-result'),
            (text) => /Injected \d+ demo scans and \d+ demo alerts across \d+ distinct targets\./.test(text),
            20000
        );
        await waitForNumericText(driver, By.id('workspace-correlation-count'), (count) => count > 0, 20000);
        await driver.wait(async () => {
            const cards = await driver.findElements(By.css('#workspace-correlations-grid .correlation-card'));
            return cards.length > 0;
        }, 15000, 'Expected at least one correlation card to render.');
    });

    it('refreshes the ML Module and injects an autonomy demo', async () => {
        await openMlModule(driver, baseUrl);
        await waitForBodyText(driver, 'Observed Autonomous Outcomes');
        await waitForBodyText(driver, 'Learned Feature Influence');
        await waitForBodyText(driver, 'Recent Scored Alerts');

        await clickElement(driver, By.id('ml-refresh-btn'));
        await waitForElementText(
            driver,
            By.id('ml-status'),
            (text) => text.includes('ML module refreshed.'),
            20000
        );

        await clickElement(driver, By.id('ml-autonomy-demo-btn'));
        await waitForElementText(
            driver,
            By.id('ml-status'),
            (text) => /Injected \d+ autonomy demo alert\(s\) in dry-run mode\./.test(text),
            30000
        );
        await waitForNumericText(driver, By.id('ml-alert-total-count'), (count) => count > 0, 30000);
        await driver.wait(async () => {
            const cards = await driver.findElements(By.css('#ml-recent-alerts-grid .security-alert-card'));
            return cards.length > 0;
        }, 15000, 'Expected recent scored alerts to render after the autonomy demo.');
    });
});
