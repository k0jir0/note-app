const { buildScriptMetadata } = require('../browserResearchModuleShared');
const {
    DEFAULT_SCENARIO_ID,
    describeAssertion,
    describeRoutePath,
    describeTag,
    getScenarioDefinition,
    normalizeBaseUrl,
    buildScenarioFunctionDescription
} = require('./descriptors');

const SCRIPT_STEP_MAP = {
    'auth-login-form': [
        'await page.goto(`${baseUrl}/auth/login`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Login\');',
        'await expect(page.locator(\'form[action="/auth/login"]\')).toBeVisible();',
        'await expect(page.locator(\'#email\')).toHaveAttribute(\'type\', \'email\');',
        'await expect(page.locator(\'#password\')).toHaveAttribute(\'type\', \'password\');'
    ].join('\n    '),
    'auth-signup-form': [
        'await page.goto(`${baseUrl}/auth/signup`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Sign Up\');',
        'await expect(page.locator(\'form[action="/auth/signup"]\')).toBeVisible();',
        'await expect(page.locator(\'#password\')).toHaveAttribute(\'minlength\', \'8\');',
        'await expectBodyText(page, \'Password requirements:\');'
    ].join('\n    '),
    'auth-signup-login-flow': [
        'await page.goto(`${baseUrl}/auth/signup`, { waitUntil: \'domcontentloaded\' });',
        'await page.locator(\'#email\').fill(email);',
        'await page.locator(\'#password\').fill(password);',
        'await Promise.all([',
        '    page.waitForURL(/\\/auth\\/login$/),',
        '    page.getByRole(\'button\', { name: \'Sign Up\' }).click()',
        ']);',
        'await signIn(page);',
        'await expectBodyText(page, \'Notes\');'
    ].join('\n    '),
    'research-playwright-entry-flow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Playwright Testing Module\');',
        'await page.locator(\'a[href="/playwright/module"]\').click();',
        'await expect(page).toHaveURL(`${baseUrl}/playwright/module`);'
    ].join('\n    '),
    'workspace-navigation': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Security Operations Module\');',
        'await expectBodyText(page, \'Alert Triage ML Module\');',
        'await expectBodyText(page, \'Selenium Testing Module\');',
        'await expectBodyText(page, \'Playwright Testing Module\');',
        'await expectBodyText(page, \'Query Injection Prevention Module\');',
        'await expectBodyText(page, \'XSS and CSP Defense Module\');',
        'await expectBodyText(page, \'Server Access Control Module\');',
        'await expectBodyText(page, \'Self-Healing Locator Repair Module\');',
        'await expectBodyText(page, \'Session Security Module\');',
        'await expectBodyText(page, \'Hardware-Backed MFA Module\');',
        'await expectBodyText(page, \'Mission Access Assurance Module\');'
    ].join('\n    '),
    'security-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Security Operations Module\');',
        'await expectBodyText(page, \'Security Controls\');',
        'await expect(page.locator(\'#workspace-refresh-all\')).toBeVisible();',
        'await expectBodyText(page, \'Log Analysis\');',
        'await expectBodyText(page, \'Scan Importer\');'
    ].join('\n    '),
    'ml-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/ml/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Alert Triage ML Module\');',
        'await expect(page.locator(\'#ml-train-hybrid-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Observed Autonomous Outcomes\');',
        'await expectBodyText(page, \'Learned Feature Influence\');',
        'await expectBodyText(page, \'Recent Scored Alerts\');'
    ].join('\n    '),
    'selenium-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/selenium/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Selenium Testing Module\');',
        'await expect(page.locator(\'#selenium-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Scenario Catalog\');',
        'await expectBodyText(page, \'Generated Script Preview\');',
        'await expectBodyText(page, \'Browser Prerequisites\');'
    ].join('\n    '),
    'playwright-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Playwright Testing Module\');',
        'await expect(page.locator(\'#playwright-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Scenario Catalog\');',
        'await expectBodyText(page, \'Generated Spec Preview\');',
        'await expectBodyText(page, \'Playwright Prerequisites\');'
    ].join('\n    '),
    'injection-prevention-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/injection-prevention/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Query Injection Prevention Module\');',
        'await expect(page.locator(\'#injection-prevention-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Architectural Controls\');',
        'await expectBodyText(page, \'Structured Query Templates\');',
        'await expect(page.locator(\'#injection-prevention-evaluation\')).toContainText(\'Prevention Decision\');'
    ].join('\n    '),
    'xss-defense-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/xss-defense/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'XSS and CSP Defense Module\');',
        'await expect(page.locator(\'#xss-defense-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Rendering And Header Controls\');',
        'await expectBodyText(page, \'Directive Set\');',
        'await expect(page.locator(\'#xss-defense-evaluation\')).toContainText(\'Escaped Preview\');'
    ].join('\n    '),
    'access-control-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/access-control/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Server Access Control Module\');',
        'await expect(page.locator(\'#access-control-scenario-select\')).toBeVisible();',
        'await expectBodyText(page, \'Protected API Catalog\');',
        'await expectBodyText(page, \'Verified Server Context\');',
        'await expect(page.locator(\'#access-control-evaluation\')).toContainText(\'Route\');'
    ].join('\n    '),
    'self-healing-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/locator-repair/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page).toHaveURL(`${baseUrl}/self-healing/module`);',
        'await expectBodyText(page, \'Self-Healing Locator Repair Module\');',
        'await expect(page.locator(\'#locator-repair-sample-select\')).toBeVisible();',
        'await expect(page.locator(\'#locator-repair-analyze-btn\')).toBeVisible();',
        'await page.locator(\'#locator-repair-sample-select\').selectOption(\'locator-analyze-button-drift\');',
        'await page.locator(\'#locator-repair-load-sample-btn\').click();',
        'await page.locator(\'#locator-repair-analyze-btn\').click();',
        'await expectBodyText(page, \'Generated ML-assisted self-healing suggestions.\');',
        'await expect(page.locator(\'#locator-repair-suggestions\')).toContainText(\'data-testid\');'
    ].join('\n    '),
    'mission-assurance-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/mission-assurance/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Mission Access Assurance Module\');',
        'await expect(page.locator(\'#mission-assurance-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Policy Decision\');',
        'await expectBodyText(page, \'RBAC\');',
        'await expectBodyText(page, \'ABAC\');'
    ].join('\n    '),
    'hardware-mfa-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/hardware-mfa/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Hardware-Backed MFA Module\');',
        'await expect(page.locator(\'#hardware-mfa-start-btn\')).toBeVisible();',
        'await expect(page.locator(\'#hardware-mfa-verify-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Challenge And Verify\');',
        'await expectBodyText(page, \'Hardware token\');',
        'await expectBodyText(page, \'PKI\');'
    ].join('\n    '),
    'session-management-module-smoke': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/session-management/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Session Security Module\');',
        'await expect(page.locator(\'#session-management-summary\')).toContainText(\'Network zone\');',
        'await expect(page.locator(\'#session-management-scenario-select\')).toBeVisible();',
        'await expect(page.locator(\'#session-management-evaluate-btn\')).toBeVisible();',
        'await expect(page.locator(\'#session-management-evaluation\')).toContainText(\'Lockdown Decision\');'
    ].join('\n    '),
    'notes-crud-workflow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/notes/new`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Create Note\');',
        'await page.locator(\'#title\').fill(\'Playwright CRUD note\');',
        'await page.locator(\'#content\').fill(\'Created through the server-rendered notes flow.\');',
        'await Promise.all([',
        '    page.waitForURL(/\\/notes$/),',
        '    page.getByRole(\'button\', { name: \'Create Note\' }).click()',
        ']);',
        'await expectBodyText(page, \'Playwright CRUD note\');'
    ].join('\n    '),
    'security-module-workflow': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page.locator(\'#workspace-refresh-all\')).toBeVisible();',
        'await page.locator(\'#workspace-load-sample-log\').click();',
        'await expect(page.locator(\'#workspace-log-text\')).toHaveValue(/POST \\/auth\\/login 401/);',
        'await page.locator(\'#workspace-log-form button[type="submit"]\').click();',
        'await expectBodyText(page, \'alert(s) created\');',
        'await page.locator(\'#workspace-load-sample-scan\').click();',
        'await expect(page.locator(\'#workspace-scan-text\')).toHaveValue(/Nikto v2\\.1\\.6/);',
        'await page.locator(\'#workspace-scan-form button[type="submit"]\').click();',
        'await expectBodyText(page, \'Scan imported with\');',
        'await page.locator(\'#workspace-inject-correlation-demo\').click();',
        'await expectBodyText(page, \'Injected\');'
    ].join('\n    '),
    'playwright-module-interactions': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expect(page.locator(\'#playwright-scenario-select\')).toBeVisible();',
        'await page.locator(\'#playwright-scenario-select\').selectOption(\'security-module-workflow\');',
        'await expect(page.locator(\'#playwright-script-file-badge\')).toContainText(\'playwright-security-module-workflow.spec.js\');',
        'await page.locator(\'#playwright-load-script-btn\').click();',
        'await expectBodyText(page, \'Loaded the selected spec.\');',
        'await page.locator(\'#playwright-refresh-btn\').click();',
        'await expectBodyText(page, \'Playwright Testing Module refreshed.\');',
        'await page.locator(\'a[href="/security/module"]\').click();',
        'await expect(page).toHaveURL(`${baseUrl}/security/module`);'
    ].join('\n    '),
    'research-full-suite': [
        'await signIn(page);',
        'await page.goto(`${baseUrl}/research`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Research Workspace\');',
        'await expectBodyText(page, \'Selenium Testing Module\');',
        'await expectBodyText(page, \'Playwright Testing Module\');',
        'await expectBodyText(page, \'Query Injection Prevention Module\');',
        'await expectBodyText(page, \'XSS and CSP Defense Module\');',
        'await expectBodyText(page, \'Server Access Control Module\');',
        'await expectBodyText(page, \'Self-Healing Locator Repair Module\');',
        'await expectBodyText(page, \'Session Security Module\');',
        'await expectBodyText(page, \'Hardware-Backed MFA Module\');',
        'await expectBodyText(page, \'Mission Access Assurance Module\');',
        '',
        'await page.goto(`${baseUrl}/security/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Security Operations Module\');',
        'await expectBodyText(page, \'Security Controls\');',
        '',
        'await page.goto(`${baseUrl}/ml/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Alert Triage ML Module\');',
        'await expectBodyText(page, \'Observed Autonomous Outcomes\');',
        '',
        'await page.goto(`${baseUrl}/selenium/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Selenium Testing Module\');',
        'await expectBodyText(page, \'Generated Script Preview\');',
        '',
        'await page.goto(`${baseUrl}/playwright/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Playwright Testing Module\');',
        'await expectBodyText(page, \'Generated Spec Preview\');',
        '',
        'await page.goto(`${baseUrl}/injection-prevention/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Query Injection Prevention Module\');',
        'await expect(page.locator(\'#injection-prevention-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Prevention Decision\');',
        '',
        'await page.goto(`${baseUrl}/xss-defense/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'XSS and CSP Defense Module\');',
        'await expect(page.locator(\'#xss-defense-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Escaping And CSP Outcome\');',
        '',
        'await page.goto(`${baseUrl}/access-control/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Server Access Control Module\');',
        'await expect(page.locator(\'#access-control-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Server Decision\');',
        '',
        'await page.goto(`${baseUrl}/self-healing/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Self-Healing Locator Repair Module\');',
        'await expect(page.locator(\'#locator-repair-analyze-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Repair Candidates\');',
        '',
        'await page.goto(`${baseUrl}/session-management/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Session Security Module\');',
        'await expect(page.locator(\'#session-management-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Lockdown Decision\');',
        '',
        'await page.goto(`${baseUrl}/hardware-mfa/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Hardware-Backed MFA Module\');',
        'await expect(page.locator(\'#hardware-mfa-start-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Challenge And Verify\');',
        '',
        'await page.goto(`${baseUrl}/mission-assurance/module`, { waitUntil: \'domcontentloaded\' });',
        'await expectBodyText(page, \'Mission Access Assurance Module\');',
        'await expect(page.locator(\'#mission-assurance-evaluate-btn\')).toBeVisible();',
        'await expectBodyText(page, \'Policy Decision\');'
    ].join('\n    ')
};

function buildScriptSteps(scenarioId) {
    return SCRIPT_STEP_MAP[scenarioId] || SCRIPT_STEP_MAP[DEFAULT_SCENARIO_ID];
}

function buildScriptTemplate(baseUrl, scenario) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const scenarioSteps = buildScriptSteps(scenario.id);

    return `const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || '${normalizedBaseUrl}';
const email = process.env.PLAYWRIGHT_TEST_EMAIL || 'test@example.com';
const password = process.env.PLAYWRIGHT_TEST_PASSWORD || process.env.DEV_SEED_PASSWORD || '';

async function expectBodyText(page, text) {
    await expect(page.locator('body')).toContainText(text);
}

async function signIn(page) {
    if (!password) {
        throw new Error('Set PLAYWRIGHT_TEST_PASSWORD or DEV_SEED_PASSWORD before running protected-route Playwright specs.');
    }

    await page.goto(\`\${baseUrl}/auth/login\`, { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);

    await Promise.all([
        page.waitForURL((url) => !url.toString().includes('/auth/login'), { timeout: 15000 }),
        page.locator('form[action="/auth/login"] button[type="submit"]').click()
    ]);
}

test('${scenario.title}', async ({ page }) => {
    ${scenarioSteps}
});
`;
}

function buildScriptUsageNotes(fileName) {
    return [
        {
            label: 'Base URL override',
            description: 'Set PLAYWRIGHT_BASE_URL to target a different host.'
        },
        {
            label: 'Test credentials',
            description: 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD so the sign-in helper can reach protected routes.'
        },
        {
            label: 'Execution',
            description: `Place the exported file in a Playwright project and run npx playwright test ${fileName}.`
        }
    ];
}

function buildPlaywrightScript({ baseUrl, scenarioId = DEFAULT_SCENARIO_ID } = {}) {
    const scenario = getScenarioDefinition(scenarioId);

    if (!scenario) {
        throw new Error(`Unknown Playwright scenario: ${scenarioId}`);
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    return buildScriptMetadata({
        baseUrl: normalizedBaseUrl,
        scenario,
        describeRoutePath,
        describeAssertion,
        describeTag,
        buildScenarioFunctionDescription,
        usageNotes: buildScriptUsageNotes(`playwright-${scenario.id}.spec.js`),
        content: buildScriptTemplate(normalizedBaseUrl, scenario),
        extra: {
            fileName: `playwright-${scenario.id}.spec.js`,
            language: 'javascript',
            runtime: '@playwright/test',
            baseUrl: normalizedBaseUrl
        }
    });
}

module.exports = {
    buildPlaywrightScript
};
