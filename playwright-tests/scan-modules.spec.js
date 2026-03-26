const { test, expect } = require('@playwright/test');

// Pages to scan
const MODULE_PATHS = [
    '/research',
    '/ml/module',
    '/playwright/module',
    '/hardware-mfa/module',
    '/mission-assurance/module',
    '/injection-prevention/module',
    '/access-control/module',
    '/locator-repair/module',
    '/security/module',
    '/selenium/module',
    '/session-management/module',
    '/xss-defense/module'
];

// threshold for luminance considered 'light' (0..1 where 1 is white)
const LUMINANCE_THRESHOLD = 0.85;

// helper to compute luminance in page context
async function findLightElements(page) {
    return page.evaluate((threshold) => {
        function rgbFromStyle(style) {
            const match = (style || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

            if (!match) {
                return null;
            }

            return [Number(match[1]), Number(match[2]), Number(match[3])];
        }

        function luminance(rgb) {
            const red = rgb[0] / 255;
            const green = rgb[1] / 255;
            const blue = rgb[2] / 255;

            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        }

        const problems = [];
        const elements = Array.from(globalThis.document.querySelectorAll('body *'));

        for (const element of elements) {
            try {
                const style = globalThis.window.getComputedStyle(element);

                if (style && style.display === 'none') {
                    continue;
                }

                if (style && style.visibility === 'hidden') {
                    continue;
                }

                const background = style.backgroundColor || style.background;

                if (!background) {
                    continue;
                }

                const rgb = rgbFromStyle(background);

                if (!rgb) {
                    continue;
                }

                if (style.opacity !== undefined && Number(style.opacity) === 0) {
                    continue;
                }

                const lum = luminance(rgb);

                if (lum >= threshold) {
                    problems.push({
                        tag: element.tagName.toLowerCase(),
                        classes: element.className || '',
                        id: element.id || '',
                        background,
                        luminance: Number(lum.toFixed(3)),
                        outerHTML: element.outerHTML.slice(0, 300)
                    });
                }
            } catch (error) {
                void error;
            }
        }

        return problems.slice(0, 50);
    }, LUMINANCE_THRESHOLD);
}

// Utility to ensure signed-in test account and enable night mode
async function signUpAndEnableDark(page) {
    const email = `scan+${Date.now()}@example.com`;
    const password = 'Password123!';

    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('button[type="submit"]')
    ]);

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('button[type="submit"]')
    ]);

    await page.waitForSelector('#theme-toggle', { timeout: 5000 });
    const checked = await page.$eval('#theme-toggle', (input) => input.checked);

    if (!checked) {
        await Promise.all([
            page.waitForResponse((response) => response.url().includes('/api/settings/theme') && response.status() === 200),
            page.click('#theme-toggle')
        ]);
    }
}

// Main test
test('scan module pages for light backgrounds in dark mode', async ({ page }, testInfo) => {
    await signUpAndEnableDark(page);

    const report = {};

    for (const path of MODULE_PATHS) {
        await page.goto(path, { waitUntil: 'networkidle' });
        const screenshotPath = `test-results/scan-${path.replace(/[^a-z0-9_-]/gi, '_')}.png`;

        await page.screenshot({ path: screenshotPath, fullPage: true });

        const problems = await findLightElements(page);
        report[path] = {
            screenshot: screenshotPath,
            issues: problems
        };

        testInfo.attachments = testInfo.attachments || [];
        testInfo.attachments.push({
            name: `scan-${path}`,
            path: screenshotPath,
            contentType: 'image/png'
        });
    }

    const fs = require('fs');
    fs.writeFileSync('artifacts/module-scan-report.json', JSON.stringify(report, null, 2));

    const total = Object.values(report).reduce((count, entry) => count + (entry.issues ? entry.issues.length : 0), 0);

    console.log('Total light-background issues detected:', total);
    expect(total).toBe(0);
});
