const { By, until } = require('selenium-webdriver');

function buildCredentials() {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        email: `selenium-${runId}@example.com`,
        password: 'Password123'
    };
}

async function waitForLocationContains(driver, value, timeoutMs = 15000) {
    await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl.includes(value);
    }, timeoutMs, `Expected URL to include ${value}`);
}

async function signUp(driver, baseUrl, credentials) {
    await driver.get(`${baseUrl}/auth/signup`);
    await driver.wait(until.elementLocated(By.id('email')), 15000);

    await driver.findElement(By.id('email')).sendKeys(credentials.email);
    await driver.findElement(By.id('password')).sendKeys(credentials.password);
    await driver.findElement(By.css('form[action="/auth/signup"] button[type="submit"]')).click();

    await waitForLocationContains(driver, '/auth/login');
}

async function logIn(driver, baseUrl, credentials) {
    await driver.get(`${baseUrl}/auth/login`);
    await driver.wait(until.elementLocated(By.id('email')), 15000);

    await driver.findElement(By.id('email')).sendKeys(credentials.email);
    await driver.findElement(By.id('password')).sendKeys(credentials.password);
    await driver.findElement(By.css('form[action="/auth/login"] button[type="submit"]')).click();

    await waitForLocationContains(driver, '/notes');
}

async function createAuthenticatedSession(driver, baseUrl) {
    const credentials = buildCredentials();

    await signUp(driver, baseUrl, credentials);
    await logIn(driver, baseUrl, credentials);

    return credentials;
}

module.exports = {
    buildCredentials,
    createAuthenticatedSession,
    logIn,
    signUp,
    waitForLocationContains
};
