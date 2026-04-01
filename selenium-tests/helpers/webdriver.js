const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');

const DEFAULT_BASE_URL = 'http://localhost:3000';

function getBaseUrl() {
    return (process.env.SELENIUM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function isHeadlessEnabled() {
    return process.env.SELENIUM_HEADLESS !== '0';
}

async function waitForApp(baseUrl = getBaseUrl(), timeoutMs = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/auth/login`, {
                redirect: 'manual'
            });

            if (response.ok || response.status === 302) {
                return;
            }
        } catch (_error) {
            // Retry until timeout.
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Selenium suite could not reach ${baseUrl}. Start the app before running these tests.`);
}

function createChromeDriver() {
    const options = new chrome.Options();
    options.addArguments('--window-size=1440,1200');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');

    if (isHeadlessEnabled()) {
        options.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
}

function createEdgeDriver() {
    const options = new edge.Options();
    options.addArguments('--window-size=1440,1200');
    options.addArguments('--disable-gpu');

    if (isHeadlessEnabled()) {
        options.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('MicrosoftEdge')
        .setEdgeOptions(options)
        .build();
}

function createDriver() {
    const browser = String(process.env.SELENIUM_BROWSER || 'edge').trim().toLowerCase();

    if (browser === 'chrome') {
        return createChromeDriver();
    }

    return createEdgeDriver();
}

module.exports = {
    createDriver,
    getBaseUrl,
    waitForApp
};
