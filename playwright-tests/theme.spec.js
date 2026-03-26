const { test, expect } = require('@playwright/test');

test('signup -> login -> toggle theme -> server persists dark-mode', async ({ page }) => {
    const email = `playwright+${Date.now()}@example.com`;
    const password = 'Password123!';

    // Signup
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('button[type="submit"]')
    ]);
    // After signup the app redirects to login; perform login to create an authenticated session
    await page.waitForURL('**/auth/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('button[type="submit"]')
    ]);

    // Ensure we're authenticated by visiting /notes
    await page.goto('/notes');
    await expect(page.locator('body')).toBeVisible();

    // Grab CSRF token from meta
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    expect(csrf).toBeTruthy();

    // Click the UI toggle and wait for the settings API response to ensure persistence
    const [resp] = await Promise.all([
        page.waitForResponse((response) => response.url().includes('/api/settings/theme') && response.status() === 200),
        page.click('#theme-toggle')
    ]);
    expect(resp.ok()).toBeTruthy();

    // Reload and assert server rendered body has dark-mode
    await page.reload();
    const hasDark = await page.$eval('body', (body) => body.classList.contains('dark-mode'));
    expect(hasDark).toBeTruthy();

    // Check the page body's computed background luminance is dark
    const luminance = await page.$eval('body', (element) => {
        const style = globalThis.window.getComputedStyle(element);
        const background = style.backgroundColor || style.background;
        const rgb = (background || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

        if (!rgb) {
            return 1;
        }

        const red = Number(rgb[1]) / 255;
        const green = Number(rgb[2]) / 255;
        const blue = Number(rgb[3]) / 255;

        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    });

    expect(luminance).toBeLessThan(0.6);
});
