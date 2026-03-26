const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const { getSeleniumScenario } = require('../src/lib/seleniumScenarioRegistry');
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

async function openSeleniumModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/selenium/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Selenium Module');
    await waitForElementText(
        driver,
        By.id('selenium-status'),
        (text) => text.includes('Selenium module ready.'),
        20000,
        'Expected the Selenium Module to finish loading.'
    );
}

async function openPlaywrightModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/playwright/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Playwright Module');
    await waitForElementText(
        driver,
        By.id('playwright-status'),
        (text) => text.includes('Playwright module ready.'),
        20000,
        'Expected the Playwright Module to finish loading.'
    );
}

async function openSelfHealingModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/self-healing/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Self-Healing Module');
    await waitForElementText(
        driver,
        By.id('locator-repair-status'),
        (text) => text.includes('Self-Healing Module ready.'),
        20000,
        'Expected the Self-Healing Module to finish loading.'
    );
}

async function openMissionAssuranceModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/mission-assurance/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Mission Assurance Module');
    await waitForElementText(
        driver,
        By.id('mission-assurance-status'),
        (text) => text.includes('Mission Assurance Module ready.'),
        20000,
        'Expected the Mission Assurance Module to finish loading.'
    );
}

async function openHardwareMfaModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/hardware-mfa/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Hardware-First MFA Module');
    await waitForElementText(
        driver,
        By.id('hardware-mfa-status'),
        (text) => text.includes('Hardware-First MFA Module ready.'),
        20000,
        'Expected the Hardware-First MFA Module to finish loading.'
    );
}

async function openSessionManagementModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/session-management/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Session Management Module');
    await waitForElementText(
        driver,
        By.id('session-management-status'),
        (text) => text.includes('Session Management Module ready.'),
        20000,
        'Expected the Session Management Module to finish loading.'
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

    it(getSeleniumScenario('workspace-navigation').title, async () => {
        await openResearchWorkspace(driver, baseUrl);
        await waitForBodyText(driver, 'Security Module');
        await waitForBodyText(driver, 'ML Module');
        await waitForBodyText(driver, 'Selenium Module');
        await waitForBodyText(driver, 'Playwright Module');
        await waitForBodyText(driver, 'Self-Healing Module');
        await waitForBodyText(driver, 'Session Management Module');
        await waitForBodyText(driver, 'Hardware-First MFA Module');
        await waitForBodyText(driver, 'Mission Assurance Module');

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

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Playwright Module'));
        await waitForLocationContains(driver, '/playwright/module');
        await waitForBodyText(driver, 'Playwright Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Self-Healing Module'));
        await waitForLocationContains(driver, '/self-healing/module');
        await waitForBodyText(driver, 'Self-Healing Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Session Management Module'));
        await waitForLocationContains(driver, '/session-management/module');
        await waitForBodyText(driver, 'Session Management Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Hardware-First MFA Module'));
        await waitForLocationContains(driver, '/hardware-mfa/module');
        await waitForBodyText(driver, 'Hardware-First MFA Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Mission Assurance Module'));
        await waitForLocationContains(driver, '/mission-assurance/module');
        await waitForBodyText(driver, 'Mission Assurance Module');
    });

    it(getSeleniumScenario('security-module-workflow').title, async () => {
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

    it(getSeleniumScenario('ml-module-workflow').title, async () => {
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

    it(getSeleniumScenario('research-full-suite').title, async () => {
        await openResearchWorkspace(driver, baseUrl);
        await waitForBodyText(driver, 'Security Module');
        await waitForBodyText(driver, 'Selenium Module');

        await openSecurityModule(driver, baseUrl);
        await waitForBodyText(driver, 'Security Controls');

        await openMlModule(driver, baseUrl);
        await waitForBodyText(driver, 'Observed Autonomous Outcomes');

        await openSeleniumModule(driver, baseUrl);
        await waitForBodyText(driver, 'Latest Suite Run');

        await openPlaywrightModule(driver, baseUrl);
        await waitForBodyText(driver, 'Generated Spec Preview');

        await openSessionManagementModule(driver, baseUrl);
        await waitForBodyText(driver, 'Lockdown Decision');

        await openSelfHealingModule(driver, baseUrl);
        await waitForBodyText(driver, 'Repair Candidates');

        await openHardwareMfaModule(driver, baseUrl);
        await waitForBodyText(driver, 'Challenge And Verify');

        await openMissionAssuranceModule(driver, baseUrl);
        await waitForBodyText(driver, 'Policy Decision');
    });

    it(getSeleniumScenario('session-management-module-smoke').title, async () => {
        await openSessionManagementModule(driver, baseUrl);
        await waitForBodyText(driver, 'Live Session State');
        await driver.findElement(By.id('session-management-scenario-select'));
        await driver.findElement(By.id('session-management-evaluate-btn'));
        await waitForBodyText(driver, 'Lockdown Decision');
    });
});
