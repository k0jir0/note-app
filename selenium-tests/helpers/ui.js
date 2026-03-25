const { By, until } = require('selenium-webdriver');

function parseNumber(text) {
    const value = Number.parseInt(String(text).trim(), 10);
    return Number.isNaN(value) ? 0 : value;
}

async function getBodyText(driver) {
    return driver.findElement(By.css('body')).getText();
}

async function waitForBodyText(driver, textOrPattern, timeoutMs = 15000) {
    await driver.wait(async () => {
        const bodyText = await getBodyText(driver);

        if (textOrPattern instanceof RegExp) {
            return textOrPattern.test(bodyText);
        }

        return bodyText.includes(String(textOrPattern));
    }, timeoutMs, `Expected page body to include ${textOrPattern}`);
}

async function waitForElementText(driver, locator, predicate, timeoutMs = 15000, message) {
    await driver.wait(async () => {
        const text = await driver.findElement(locator).getText();
        return predicate(text);
    }, timeoutMs, message || 'Expected element text to reach the desired state.');
}

async function waitForElementValue(driver, locator, predicate, timeoutMs = 15000, message) {
    await driver.wait(async () => {
        const value = await driver.findElement(locator).getAttribute('value');
        return predicate(value);
    }, timeoutMs, message || 'Expected element value to reach the desired state.');
}

async function waitForNumericText(driver, locator, predicate, timeoutMs = 15000, message) {
    await waitForElementText(
        driver,
        locator,
        (text) => predicate(parseNumber(text)),
        timeoutMs,
        message || 'Expected numeric text to reach the desired state.'
    );
}

async function clickElement(driver, locator, timeoutMs = 15000) {
    const element = await driver.wait(until.elementLocated(locator), timeoutMs);

    await driver.executeScript(
        'arguments[0].scrollIntoView({ block: "center", inline: "center" });',
        element
    );

    try {
        await element.click();
    } catch (_error) {
        await driver.executeScript('arguments[0].click();', element);
    }
}

async function acceptNextAlert(driver, timeoutMs = 15000) {
    await driver.wait(until.alertIsPresent(), timeoutMs, 'Expected a browser alert to appear.');
    const alert = await driver.switchTo().alert();
    await alert.accept();
}

module.exports = {
    acceptNextAlert,
    clickElement,
    getBodyText,
    parseNumber,
    waitForBodyText,
    waitForElementText,
    waitForElementValue,
    waitForNumericText
};
