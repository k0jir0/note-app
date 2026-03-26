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
  return await page.evaluate((threshold) => {
    function rgbFromStyle(style) {
      const m = (style || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    function luminance(rgb) {
      const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    const problems = [];
    const elems = Array.from(document.querySelectorAll('body *'));
    for (const el of elems) {
      try {
        const style = window.getComputedStyle(el);
        if (style && style.display === 'none') continue;
        if (style && style.visibility === 'hidden') continue;
        const bg = style.backgroundColor || style.background;
        if (!bg) continue;
        const rgb = rgbFromStyle(bg);
        if (!rgb) continue;
        // ignore fully transparent
        if ((style.opacity !== undefined) && Number(style.opacity) === 0) continue;
        const lum = luminance(rgb);
        if (lum >= threshold) {
          problems.push({
            tag: el.tagName.toLowerCase(),
            classes: el.className || '',
            id: el.id || '',
            background: bg,
            luminance: Number(lum.toFixed(3)),
            outerHTML: el.outerHTML.slice(0, 300)
          });
        }
      } catch (e) {
        // ignore
      }
    }
    // return top 50 problems
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
  // login
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]')
  ]);
  // now on /notes (or similar) — toggle by clicking UI
  // wait for #theme-toggle
  await page.waitForSelector('#theme-toggle', { timeout: 5000 });
  // click the toggle if not already checked
  const checked = await page.$eval('#theme-toggle', (i) => i.checked);
  if (!checked) {
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/settings/theme') && r.status() === 200),
      page.click('#theme-toggle')
    ]);
  }
}

// Main test
test('scan module pages for light backgrounds in dark mode', async ({ page }, testInfo) => {
  // Sign up/login and enable dark mode
  await signUpAndEnableDark(page);

  const report = {};

  for (const path of MODULE_PATHS) {
    const url = path;
    await page.goto(url, { waitUntil: 'networkidle' });
    // take screenshot for visual inspection
    const shotPath = `test-results/scan-${path.replace(/[^a-z0-9_-]/gi, '_')}.png`;
    await page.screenshot({ path: shotPath, fullPage: true });

    const problems = await findLightElements(page);
    report[path] = {
      screenshot: shotPath,
      issues: problems
    };
    // annotate test run
    testInfo.attachments = testInfo.attachments || [];
    testInfo.attachments.push({ name: `scan-${path}`, path: shotPath, contentType: 'image/png' });
  }

  // write JSON report to artifacts area for review
  const fs = require('fs');
  fs.writeFileSync('artifacts/module-scan-report.json', JSON.stringify(report, null, 2));

  // Fail if any issues found to force attention (but include report)
  const total = Object.values(report).reduce((acc, v) => acc + (v.issues ? v.issues.length : 0), 0);
  console.log('Total light-background issues detected:', total);
  expect(total).toBe(0);
});