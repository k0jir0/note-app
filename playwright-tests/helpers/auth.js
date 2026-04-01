const { expect } = require('@playwright/test');

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

async function createAuthenticatedSession(page, testInfo) {
    const credentials = buildCredentials(testInfo);

    await signUp(page, credentials);
    await logIn(page, credentials);

    return credentials;
}

module.exports = {
    buildCredentials,
    createAuthenticatedSession,
    logIn,
    signUp
};
