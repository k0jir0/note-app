const { test, expect } = require('@playwright/test');

function buildCredentials(testInfo) {
    const runId = `${Date.now()}-${testInfo.parallelIndex}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        email: `playwright-${runId}@example.com`,
        password: 'Password123'
    };
}

async function signUp(page, credentials) {
    await page.goto('/auth/signup');
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.password);

    await Promise.all([
        page.waitForURL(/\/auth\/login$/),
        page.getByRole('button', { name: 'Sign Up' }).click()
    ]);

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
}

async function logIn(page, credentials) {
    await page.goto('/auth/login');
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.password);

    await Promise.all([
        page.waitForURL(/\/notes$/),
        page.getByRole('button', { name: 'Login' }).click()
    ]);
}

test.describe('Authentication smoke coverage', () => {
    test('renders the login form', async ({ page }) => {
        await page.goto('/auth/login');

        await expect(page).toHaveURL(/\/auth\/login$/);
        await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
        await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
        await expect(page.locator('#email')).toHaveAttribute('type', 'email');
        await expect(page.locator('#password')).toHaveAttribute('type', 'password');
        await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    });

    test('renders the signup form and password guidance', async ({ page }) => {
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

    test('allows a new user to sign up and land on the notes home after login', async ({ page }, testInfo) => {
        const credentials = buildCredentials(testInfo);

        await signUp(page, credentials);
        await logIn(page, credentials);

        await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
        await expect(page.locator('body')).toContainText(`Welcome, ${credentials.email}`);
        await expect(page.getByRole('link', { name: 'Create Note' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Research' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    });

    test('lets an authenticated user reach the Research workspace and Playwright module', async ({ page }, testInfo) => {
        const credentials = buildCredentials(testInfo);

        await signUp(page, credentials);
        await logIn(page, credentials);

        await page.getByRole('link', { name: 'Research' }).click();
        await expect(page).toHaveURL(/\/research$/);
        await expect(page.getByRole('heading', { name: 'Research Workspace' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Playwright Module', exact: true })).toBeVisible();

        await page.getByRole('link', { name: 'Open Playwright Module' }).click();
        await expect(page).toHaveURL(/\/playwright\/module$/);
        await expect(page.getByRole('heading', { name: 'Playwright Module', exact: true })).toBeVisible();
        await expect(page.locator('#playwright-scenario-count')).toHaveText('6');
        await expect(page.locator('#playwright-scenario-select option')).toHaveCount(6);
        await expect(page.locator('#playwright-script-file-badge')).toContainText('.spec.js');
        await expect(page.locator('#playwright-script-code')).toContainText('@playwright/test');
        await expect(page.locator('#playwright-status')).toContainText('Playwright module ready.');
    });
});
