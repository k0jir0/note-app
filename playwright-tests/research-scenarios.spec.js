const { test, expect } = require('@playwright/test');
const {
    getPlaywrightScenario,
    listPlaywrightScenarios
} = require('../src/lib/playwrightScenarioRegistry');
const { createAuthenticatedSession } = require('./helpers/auth');

const scenarioCount = listPlaywrightScenarios().length;

function annotateScenario(testInfo, scenario) {
    testInfo.annotations.push({ type: 'playwright-scenario', description: scenario.id });
}

async function expectResearchWorkspace(page) {
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByRole('heading', { name: 'Research Workspace' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Security Module');
    await expect(page.locator('body')).toContainText('ML Module');
    await expect(page.locator('body')).toContainText('Selenium Module');
    await expect(page.locator('body')).toContainText('Playwright Module');
    await expect(page.locator('body')).toContainText('Injection Prevention Module');
    await expect(page.locator('body')).toContainText('Self-Healing Module');
    await expect(page.locator('body')).toContainText('Session Management Module');
    await expect(page.locator('body')).toContainText('Hardware-First MFA Module');
    await expect(page.locator('body')).toContainText('Mission Assurance Module');
}

async function expectSecurityModule(page) {
    await expect(page).toHaveURL(/\/security\/module$/);
    await expect(page.getByRole('heading', { name: 'Security Module', exact: true })).toBeVisible();
    await expect(page.locator('#workspace-refresh-all')).toBeVisible();
    await expect(page.locator('#realtime-server-badge')).toBeVisible();
    await expect(page.locator('body')).toContainText('Log Analysis');
    await expect(page.locator('body')).toContainText('Scan Importer');
}

async function expectMlModule(page) {
    await expect(page).toHaveURL(/\/ml\/module$/);
    await expect(page.getByRole('heading', { name: 'ML Module', exact: true })).toBeVisible();
    await expect(page.locator('#ml-train-hybrid-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Observed Autonomous Outcomes');
    await expect(page.locator('body')).toContainText('Learned Feature Influence');
    await expect(page.locator('body')).toContainText('Recent Scored Alerts');
}

async function expectSeleniumModule(page) {
    await expect(page).toHaveURL(/\/selenium\/module$/);
    await expect(page.getByRole('heading', { name: 'Selenium Module', exact: true })).toBeVisible();
    await expect(page.locator('#selenium-scenario-select')).toBeVisible();
    await expect(page.locator('body')).toContainText('Scenario Catalog');
    await expect(page.locator('body')).toContainText('Generated Script Preview');
    await expect(page.locator('body')).toContainText('Browser Prerequisites');
}

async function expectPlaywrightModule(page) {
    await expect(page).toHaveURL(/\/playwright\/module$/);
    await expect(page.getByRole('heading', { name: 'Playwright Module', exact: true })).toBeVisible();
    await expect(page.locator('#playwright-scenario-select')).toBeVisible();
    await expect(page.locator('body')).toContainText('Scenario Catalog');
    await expect(page.locator('body')).toContainText('Generated Spec Preview');
    await expect(page.locator('body')).toContainText('Playwright Prerequisites');
}

async function expectInjectionPreventionModule(page) {
    await expect(page).toHaveURL(/\/injection-prevention\/module$/);
    await expect(page.getByRole('heading', { name: 'Injection Prevention Module', exact: true })).toBeVisible();
    await expect(page.locator('#injection-prevention-scenario-select')).toBeVisible();
    await expect(page.locator('#injection-prevention-evaluate-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Architectural Controls');
    await expect(page.locator('body')).toContainText('Structured Query Templates');
    await expect(page.locator('body')).toContainText('Prevention Decision');
}

async function expectSelfHealingModule(page) {
    await expect(page).toHaveURL(/\/self-healing\/module$/);
    await expect(page.getByRole('heading', { name: 'Self-Healing Module', exact: true })).toBeVisible();
    await expect(page.locator('#locator-repair-sample-select')).toBeVisible();
    await expect(page.locator('#locator-repair-analyze-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Repair Candidates');
    await expect(page.locator('#locator-repair-output-targets')).toContainText(/Playwright (?:and|\+) Selenium/);
}

async function expectMissionAssuranceModule(page) {
    await expect(page).toHaveURL(/\/mission-assurance\/module$/);
    await expect(page.getByRole('heading', { name: 'Mission Assurance Module', exact: true })).toBeVisible();
    await expect(page.locator('#mission-assurance-evaluate-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Policy Decision');
    await expect(page.locator('body')).toContainText('RBAC');
    await expect(page.locator('body')).toContainText('ABAC');
}

async function expectHardwareMfaModule(page) {
    await expect(page).toHaveURL(/\/hardware-mfa\/module$/);
    await expect(page.getByRole('heading', { name: 'Hardware-First MFA Module', exact: true })).toBeVisible();
    await expect(page.locator('#hardware-mfa-start-btn')).toBeVisible();
    await expect(page.locator('#hardware-mfa-verify-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Challenge And Verify');
    await expect(page.locator('body')).toContainText('Hardware token');
    await expect(page.locator('body')).toContainText('PKI');
}

async function expectSessionManagementModule(page) {
    await expect(page).toHaveURL(/\/session-management\/module$/);
    await expect(page.getByRole('heading', { name: 'Session Management Module', exact: true })).toBeVisible();
    await expect(page.locator('#session-management-scenario-select')).toBeVisible();
    await expect(page.locator('#session-management-evaluate-btn')).toBeVisible();
    await expect(page.locator('body')).toContainText('Live Session State');
    await expect(page.locator('body')).toContainText('Lockdown Decision');
}

test.describe('Research workspace scenario coverage', () => {
    test(getPlaywrightScenario('workspace-navigation').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('workspace-navigation');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/research');
        await expectResearchWorkspace(page);
    });

    test(getPlaywrightScenario('security-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('security-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/security/module');
        await expectSecurityModule(page);
    });

    test(getPlaywrightScenario('ml-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('ml-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/ml/module');
        await expectMlModule(page);
    });

    test(getPlaywrightScenario('selenium-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('selenium-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/selenium/module');
        await expectSeleniumModule(page);
    });

    test(getPlaywrightScenario('playwright-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('playwright-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/playwright/module');
        await expectPlaywrightModule(page);
        await expect(page.locator('#playwright-scenario-count')).toHaveText(String(scenarioCount));
        await expect(page.locator('#playwright-script-code')).toContainText('@playwright/test');
    });

    test(getPlaywrightScenario('injection-prevention-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('injection-prevention-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/injection-prevention/module');
        await expectInjectionPreventionModule(page);
        await expect(page.locator('#injection-prevention-status')).toContainText('Injection Prevention Module ready.');
    });

    test(getPlaywrightScenario('self-healing-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('self-healing-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/locator-repair/module');
        await expectSelfHealingModule(page);
        await expect(page.locator('#locator-repair-status')).toContainText('Self-Healing Module ready.');

        await page.locator('#locator-repair-sample-select').selectOption('locator-analyze-button-drift');
        await page.locator('#locator-repair-load-sample-btn').click();
        await expect(page.locator('#locator-repair-status')).toContainText('Loaded the selected sample case.');
        await expect(page.locator('#locator-repair-original-locator')).toHaveValue(/Analyze Locator/);

        await page.locator('#locator-repair-analyze-btn').click();
        await expect(page.locator('#locator-repair-status')).toContainText('Generated ML-assisted self-healing suggestions.');
        await expect(page.locator('#locator-repair-suggestions')).toContainText('data-testid');
        await expect(page.locator('#locator-repair-suggestions')).toContainText('locator-repair-analyze-btn');
    });

    test(getPlaywrightScenario('session-management-module-smoke').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('session-management-module-smoke');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/session-management/module');
        await expectSessionManagementModule(page);
        await expect(page.locator('#session-management-status')).toContainText('Session Management Module ready.');
    });

    test(getPlaywrightScenario('research-full-suite').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('research-full-suite');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);

        await page.goto('/research');
        await expectResearchWorkspace(page);

        await page.goto('/security/module');
        await expectSecurityModule(page);

        await page.goto('/ml/module');
        await expectMlModule(page);

        await page.goto('/selenium/module');
        await expectSeleniumModule(page);

        await page.goto('/playwright/module');
        await expectPlaywrightModule(page);

        await page.goto('/injection-prevention/module');
        await expectInjectionPreventionModule(page);

        await page.goto('/self-healing/module');
        await expectSelfHealingModule(page);

        await page.goto('/session-management/module');
        await expectSessionManagementModule(page);

        await page.goto('/hardware-mfa/module');
        await expectHardwareMfaModule(page);

        await page.goto('/mission-assurance/module');
        await expectMissionAssuranceModule(page);
    });
});
