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

async function expectWorkspaceReady(page) {
    await expect(page.getByRole('heading', { name: 'Security Operations Module', exact: true })).toBeVisible();
    await expect(page.locator('#workspace-refresh-all')).toBeVisible();
    await expect(page.locator('#workspace-status')).toContainText(/Workspace loaded|Workspace loaded with partial data/);
}

test.describe('Research module interaction coverage', () => {
    test(getPlaywrightScenario('security-module-workflow').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('security-module-workflow');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/security/module');
        await expectWorkspaceReady(page);

        await page.locator('#workspace-load-sample-log').click();
        await expect(page.locator('#workspace-log-text')).toHaveValue(/POST \/auth\/login 401/);
        await expect(page.locator('#workspace-log-result')).toContainText('Sample log loaded.');

        await page.locator('#workspace-log-form button[type="submit"]').click();
        await expect(page.locator('#workspace-log-result')).toContainText(/\d+ alert\(s\) created from 16 lines\./);
        await expect.poll(async () => Number.parseInt(await page.locator('#workspace-alert-count').innerText(), 10)).toBeGreaterThan(0);
        await expect(page.locator('#workspace-alerts-grid .security-alert-card').first()).toBeVisible();

        await page.locator('#workspace-alerts-grid [data-alert-feedback="important"]').first().click();
        await expect(page.locator('#workspace-status')).toContainText('Alert feedback updated: Important.');

        await page.locator('#workspace-load-sample-scan').click();
        await expect(page.locator('#workspace-scan-text')).toHaveValue(/Nikto v2\.1\.6/);
        await expect(page.locator('#workspace-scan-result')).toContainText('Sample scan loaded.');

        await page.locator('#workspace-scan-form button[type="submit"]').click();
        await expect(page.locator('#workspace-scan-result')).toContainText(/Scan imported with \d+ finding\(s\)\./);
        await expect.poll(async () => Number.parseInt(await page.locator('#workspace-scan-count').innerText(), 10)).toBeGreaterThan(0);
        await expect(page.locator('#workspace-scans-grid .scan-result-card').first()).toBeVisible();

        await page.locator('#workspace-inject-correlation-demo').click();
        await expect(page.locator('#workspace-correlation-result')).toContainText(/Injected \d+ demo scans and \d+ demo alerts across \d+ distinct targets\./);
        await expect.poll(async () => Number.parseInt(await page.locator('#workspace-correlation-count').innerText(), 10)).toBeGreaterThan(0);
        await expect(page.locator('#workspace-correlations-grid .correlation-card').first()).toBeVisible();
    });

    test(getPlaywrightScenario('playwright-module-interactions').title, async ({ page }, testInfo) => {
        const scenario = getPlaywrightScenario('playwright-module-interactions');
        annotateScenario(testInfo, scenario);

        await createAuthenticatedSession(page, testInfo);
        await page.goto('/playwright/module');

        await expect(page.getByRole('heading', { name: 'Playwright Testing Module', exact: true })).toBeVisible();
        await expect(page.locator('#playwright-scenario-count')).toHaveText(String(scenarioCount));
        await expect(page.locator('#playwright-status')).toContainText('Playwright Testing Module ready.');

        await page.locator('#playwright-scenario-select').selectOption('security-module-workflow');
        await expect(page.locator('#playwright-status')).toContainText('Updated the spec preview for the selected scenario.');
        await expect(page.locator('#playwright-script-file-badge')).toHaveText('playwright-security-module-workflow.spec.js');
        await expect(page.locator('#playwright-script-summary')).toContainText('Security Module Interactive Workflow');
        await expect(page.locator('#playwright-script-code')).toContainText('#workspace-load-sample-log');

        await page.locator('#playwright-scenario-select').selectOption('playwright-module-interactions');
        await page.locator('#playwright-load-script-btn').click();
        await expect(page.locator('#playwright-status')).toContainText('Loaded the selected spec.');
        await expect(page.locator('#playwright-script-file-badge')).toHaveText('playwright-playwright-module-interactions.spec.js');
        await expect(page.locator('#playwright-script-summary')).toContainText('Playwright Module Interaction Flow');
        await expect(page.locator('#playwright-script-code')).toContainText('#playwright-refresh-btn');

        await page.locator('#playwright-refresh-btn').click();
        await expect(page.locator('#playwright-status')).toContainText('Playwright Testing Module refreshed.');

        await page.getByRole('link', { name: 'Open Security Operations Module' }).click();
        await expect(page).toHaveURL(/\/security\/module$/);
        await expect(page.getByRole('heading', { name: 'Security Operations Module', exact: true })).toBeVisible();
    });
});
