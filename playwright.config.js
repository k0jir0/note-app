const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const shouldManageWebServer = !process.env.PLAYWRIGHT_BASE_URL;

module.exports = defineConfig({
    testDir: './playwright-tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'artifacts/playwright-results.json' }]
    ],
    use: {
        baseURL,
        headless: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    webServer: shouldManageWebServer ? {
        command: 'npm run start',
        url: `${baseURL}/auth/login`,
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        env: {
            ...process.env,
            DISABLE_REDIS: '1',
            PORT: '3000'
        }
    } : undefined,
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            }
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox']
            }
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari']
            }
        }
    ]
});
