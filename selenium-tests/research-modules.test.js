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
    await waitForBodyText(driver, 'Security Operations Module');
    await waitForElementText(
        driver,
        By.id('workspace-status'),
        (text) => /Workspace loaded(\.| with partial data\.)/.test(text),
        20000,
        'Expected the Security Operations Module to finish loading.'
    );
}

async function openMlModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/ml/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Alert Triage ML Module');
    await waitForElementText(
        driver,
        By.id('ml-status'),
        (text) => text.includes('Alert Triage ML module ready.'),
        20000,
        'Expected the Alert Triage ML Module to finish loading.'
    );
}

async function openSeleniumModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/selenium/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Selenium Testing Module');
    await waitForElementText(
        driver,
        By.id('selenium-status'),
        (text) => text.includes('Selenium Testing module ready.'),
        20000,
        'Expected the Selenium Testing Module to finish loading.'
    );
}

async function openPlaywrightModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/playwright/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Playwright Testing Module');
    await waitForElementText(
        driver,
        By.id('playwright-status'),
        (text) => text.includes('Playwright Testing module ready.'),
        20000,
        'Expected the Playwright Testing Module to finish loading.'
    );
}

async function openInjectionPreventionModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/injection-prevention/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Query Injection Prevention Module');
    await waitForElementText(
        driver,
        By.id('injection-prevention-status'),
        (text) => text.includes('Query Injection Prevention Module ready.'),
        20000,
        'Expected the Query Injection Prevention Module to finish loading.'
    );
}

async function openXssDefenseModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/xss-defense/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'XSS and CSP Defense Module');
    await waitForElementText(
        driver,
        By.id('xss-defense-status'),
        (text) => text.includes('XSS and CSP Defense Module ready.'),
        20000,
        'Expected the XSS and CSP Defense Module to finish loading.'
    );
}

async function openAccessControlModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/access-control/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Server Access Control Module');
    await waitForElementText(
        driver,
        By.id('access-control-status'),
        (text) => text.includes('Server Access Control Module ready.'),
        20000,
        'Expected the Server Access Control Module to finish loading.'
    );
}

async function openSelfHealingModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/self-healing/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Self-Healing Locator Repair Module');
    await waitForElementText(
        driver,
        By.id('locator-repair-status'),
        (text) => text.includes('Self-Healing Locator Repair Module ready.'),
        20000,
        'Expected the Self-Healing Locator Repair Module to finish loading.'
    );
}

async function openMissionAssuranceModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/mission-assurance/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Mission Access Assurance Module');
    await waitForElementText(
        driver,
        By.id('mission-assurance-status'),
        (text) => text.includes('Mission Access Assurance Module ready.'),
        20000,
        'Expected the Mission Access Assurance Module to finish loading.'
    );
}

async function openHardwareMfaModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/hardware-mfa/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Hardware-Backed MFA Module');
    await waitForElementText(
        driver,
        By.id('hardware-mfa-status'),
        (text) => text.includes('Hardware-Backed MFA Module ready.'),
        20000,
        'Expected the Hardware-Backed MFA Module to finish loading.'
    );
}

async function openSessionManagementModule(driver, baseUrl) {
    await driver.get(`${baseUrl}/session-management/module`);
    await driver.wait(until.elementLocated(By.css('h1')), 15000);
    await waitForBodyText(driver, 'Session Security Module');
    await waitForElementText(
        driver,
        By.id('session-management-status'),
        (text) => text.includes('Session Security Module ready.'),
        20000,
        'Expected the Session Security Module to finish loading.'
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
        await waitForBodyText(driver, 'Security Operations Module');
        await waitForBodyText(driver, 'Alert Triage ML Module');
        await waitForBodyText(driver, 'Selenium Testing Module');
        await waitForBodyText(driver, 'Playwright Testing Module');
        await waitForBodyText(driver, 'Query Injection Prevention Module');
        await waitForBodyText(driver, 'XSS and CSP Defense Module');
        await waitForBodyText(driver, 'Server Access Control Module');
        await waitForBodyText(driver, 'Self-Healing Locator Repair Module');
        await waitForBodyText(driver, 'Session Security Module');
        await waitForBodyText(driver, 'Hardware-Backed MFA Module');
        await waitForBodyText(driver, 'Mission Access Assurance Module');

        await clickElement(driver, By.linkText('Open Security Operations Module'));
        await waitForLocationContains(driver, '/security/module');
        await waitForBodyText(driver, 'Security Operations Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Alert Triage ML Module'));
        await waitForLocationContains(driver, '/ml/module');
        await waitForBodyText(driver, 'Alert Triage ML Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Selenium Testing Module'));
        await waitForLocationContains(driver, '/selenium/module');
        await waitForBodyText(driver, 'Selenium Testing Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Playwright Testing Module'));
        await waitForLocationContains(driver, '/playwright/module');
        await waitForBodyText(driver, 'Playwright Testing Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Query Injection Prevention Module'));
        await waitForLocationContains(driver, '/injection-prevention/module');
        await waitForBodyText(driver, 'Query Injection Prevention Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open XSS and CSP Defense Module'));
        await waitForLocationContains(driver, '/xss-defense/module');
        await waitForBodyText(driver, 'XSS and CSP Defense Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Server Access Control Module'));
        await waitForLocationContains(driver, '/access-control/module');
        await waitForBodyText(driver, 'Server Access Control Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Self-Healing Locator Repair Module'));
        await waitForLocationContains(driver, '/self-healing/module');
        await waitForBodyText(driver, 'Self-Healing Locator Repair Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Session Security Module'));
        await waitForLocationContains(driver, '/session-management/module');
        await waitForBodyText(driver, 'Session Security Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Hardware-Backed MFA Module'));
        await waitForLocationContains(driver, '/hardware-mfa/module');
        await waitForBodyText(driver, 'Hardware-Backed MFA Module');

        await clickElement(driver, By.css('a[href="/research"]'));
        await waitForLocationContains(driver, '/research');

        await clickElement(driver, By.linkText('Open Mission Access Assurance Module'));
        await waitForLocationContains(driver, '/mission-assurance/module');
        await waitForBodyText(driver, 'Mission Access Assurance Module');
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

    it(getSeleniumScenario('injection-prevention-module-smoke').title, async () => {
        await openInjectionPreventionModule(driver, baseUrl);
        await waitForBodyText(driver, 'Architectural Controls');
        await waitForBodyText(driver, 'Structured Query Templates');
        await driver.findElement(By.id('injection-prevention-scenario-select'));
        await driver.findElement(By.id('injection-prevention-evaluate-btn'));
        await waitForBodyText(driver, 'Prevention Decision');
    });

    it(getSeleniumScenario('xss-defense-module-smoke').title, async () => {
        await openXssDefenseModule(driver, baseUrl);
        await waitForBodyText(driver, 'Rendering And Header Controls');
        await waitForBodyText(driver, 'Directive Set');
        await driver.findElement(By.id('xss-defense-scenario-select'));
        await driver.findElement(By.id('xss-defense-evaluate-btn'));
        await waitForBodyText(driver, 'Escaping And CSP Outcome');
    });

    it(getSeleniumScenario('access-control-module-smoke').title, async () => {
        await openAccessControlModule(driver, baseUrl);
        await waitForBodyText(driver, 'Protected API Catalog');
        await waitForBodyText(driver, 'Verified Server Context');
        await driver.findElement(By.id('access-control-scenario-select'));
        await driver.findElement(By.id('access-control-evaluate-btn'));
        await waitForBodyText(driver, 'Server Decision');
    });

    it(getSeleniumScenario('mission-assurance-module-smoke').title, async () => {
        await openMissionAssuranceModule(driver, baseUrl);
        await waitForBodyText(driver, 'Policy Decision');
        await waitForBodyText(driver, 'RBAC');
        await waitForBodyText(driver, 'ABAC');
        await driver.findElement(By.id('mission-assurance-evaluate-btn'));
    });

    it(getSeleniumScenario('hardware-mfa-module-smoke').title, async () => {
        await openHardwareMfaModule(driver, baseUrl);
        await waitForBodyText(driver, 'Challenge And Verify');
        await waitForBodyText(driver, 'Hardware token');
        await waitForBodyText(driver, 'PKI');
        await driver.findElement(By.id('hardware-mfa-start-btn'));
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

        await openInjectionPreventionModule(driver, baseUrl);
        await waitForBodyText(driver, 'Prevention Decision');

        await openXssDefenseModule(driver, baseUrl);
        await waitForBodyText(driver, 'Escaping And CSP Outcome');

        await openAccessControlModule(driver, baseUrl);
        await waitForBodyText(driver, 'Server Decision');

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
