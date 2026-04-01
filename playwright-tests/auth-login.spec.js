const { test, expect } = require('@playwright/test');
const {
    getPlaywrightScenario,
    listPlaywrightScenarios
} = require('../src/lib/playwrightScenarioRegistry');
const {
    buildCredentials,
    logIn,
    signUp
} = require('./helpers/auth');

const scenarioCount = listPlaywrightScenarios().length;

function annotateScenario(testInfo, scenario) {
    testInfo.annotations.push({ type: 'playwright-scenario', description: scenario.id });
}

test.describe('Authentication smoke coverage', () => {
    test(getPlaywrightScenario('auth-login-form').title, async ({ page }, testInfo) => {
        annotateScenario(testInfo, getPlaywrightScenario('auth-login-form'));
        await page.goto('/auth/login');

        await expect(page).toHaveURL(/\/auth\/login$/);
        await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
        await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
        await expect(page.locator('#email')).toHaveAttribute('type', 'email');
        await expect(page.locator('#password')).toHaveAttribute('type', 'password');
        await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    });

    test(getPlaywrightScenario('auth-signup-form').title, async ({ page }, testInfo) => {
        annotateScenario(testInfo, getPlaywrightScenario('auth-signup-form'));
        await page.goto('/auth/signup');

        await expect(page).toHaveURL(/\/auth\/signup$/);
        await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
        await expect(page.locator('form[action="/auth/signup"]')).toBeVisible();
        await expect(page.locator('#password')).toHaveAttribute('minlength', '8');
        await expect(page.locator('body')).toContainText('Password requirements:');
        await expect(page.locator('body')).toContainText('Contains at least one uppercase letter');
        await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    });

    test(getPlaywrightScenario('auth-signup-login-flow').title, async ({ page }, testInfo) => {
        annotateScenario(testInfo, getPlaywrightScenario('auth-signup-login-flow'));
        const credentials = buildCredentials(testInfo);

        await signUp(page, credentials);
        await logIn(page, credentials);

        await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
        await expect(page.locator('body')).toContainText(`Welcome, ${credentials.email}`);
        await expect(page.getByRole('link', { name: 'Create Note' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Research' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    });

    test(getPlaywrightScenario('research-playwright-entry-flow').title, async ({ page }, testInfo) => {
        annotateScenario(testInfo, getPlaywrightScenario('research-playwright-entry-flow'));
        const credentials = buildCredentials(testInfo);

        await signUp(page, credentials);
        await logIn(page, credentials);

        await page.getByRole('link', { name: 'Research' }).click();
        await expect(page).toHaveURL(/\/research$/);
        await expect(page.getByRole('heading', { name: 'Research Workspace' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Playwright Testing Module', exact: true })).toBeVisible();

        await page.getByRole('link', { name: 'Open Playwright Testing Module' }).click();
        await expect(page).toHaveURL(/\/playwright\/module$/);
        await expect(page.getByRole('heading', { name: 'Playwright Testing Module', exact: true })).toBeVisible();
        await expect(page.locator('#playwright-scenario-count')).toHaveText(String(scenarioCount));
        await expect(page.locator('#playwright-scenario-select option')).toHaveCount(scenarioCount);
        await expect(page.locator('#playwright-script-file-badge')).toContainText('.spec.js');
        await expect(page.locator('#playwright-script-code')).toContainText('@playwright/test');
        await expect(page.locator('#playwright-status')).toContainText('Playwright Testing Module ready.');
    });
});
