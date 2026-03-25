const { By, until } = require('selenium-webdriver');
const { expect } = require('chai');

const {
    buildCredentials,
    createAuthenticatedSession,
    logIn,
    signUp,
    waitForLocationContains
} = require('./helpers/auth');
const {
    acceptNextAlert,
    getBodyText,
    waitForBodyText
} = require('./helpers/ui');
const { createDriver, getBaseUrl, waitForApp } = require('./helpers/webdriver');

describe('Authentication and notes browser coverage', function () {
    this.timeout(120000);

    const baseUrl = getBaseUrl();
    let driver;

    before(async () => {
        await waitForApp(baseUrl);
    });

    beforeEach(async () => {
        driver = await createDriver();
    });

    afterEach(async () => {
        if (driver) {
            await driver.quit();
            driver = null;
        }
    });

    it('renders the login and signup forms with their expected controls', async () => {
        await driver.get(`${baseUrl}/auth/login`);
        await driver.wait(until.elementLocated(By.css('form[action="/auth/login"]')), 15000);
        await waitForBodyText(driver, 'Login');

        expect(await driver.findElement(By.id('email')).getAttribute('type')).to.equal('email');
        expect(await driver.findElement(By.id('password')).getAttribute('type')).to.equal('password');
        expect(await driver.findElement(By.css('a[href="/auth/signup"]')).getText()).to.equal('Sign up');

        await driver.findElement(By.css('a[href="/auth/signup"]')).click();
        await waitForLocationContains(driver, '/auth/signup');
        await driver.wait(until.elementLocated(By.css('form[action="/auth/signup"]')), 15000);
        await waitForBodyText(driver, 'Sign Up');
        await waitForBodyText(driver, 'Password requirements:');
        await waitForBodyText(driver, 'Contains at least one uppercase letter');

        expect(await driver.findElement(By.id('password')).getAttribute('minlength')).to.equal('8');
        expect(await driver.findElement(By.css('a[href="/auth/login"]')).getText()).to.equal('Login');
    });

    it('can sign up, log in, and navigate from notes to the research workspace', async () => {
        const credentials = buildCredentials();

        await signUp(driver, baseUrl, credentials);
        await logIn(driver, baseUrl, credentials);

        await waitForBodyText(driver, 'Notes');
        await waitForBodyText(driver, `Welcome, ${credentials.email}`);
        expect(await driver.findElement(By.linkText('Create Note')).isDisplayed()).to.equal(true);
        expect(await driver.findElement(By.linkText('Research')).isDisplayed()).to.equal(true);

        await driver.findElement(By.linkText('Research')).click();
        await waitForLocationContains(driver, '/research');
        await waitForBodyText(driver, 'Research Workspace');
        await waitForBodyText(driver, 'Security Module');
        await waitForBodyText(driver, 'ML Module');
        await waitForBodyText(driver, 'Selenium Module');
        await waitForBodyText(driver, 'Playwright Module');
    });

    it('can create, view, edit, and delete a note through the server-rendered UI', async () => {
        const noteTitle = `Selenium note ${Date.now()}`;
        const noteContent = 'Created through the Selenium CRUD browser flow.';
        const updatedTitle = `${noteTitle} updated`;
        const updatedContent = 'Updated through the Selenium edit form.';

        await createAuthenticatedSession(driver, baseUrl);

        await driver.get(`${baseUrl}/notes/new`);
        await driver.wait(until.elementLocated(By.css('form[action="/notes"]')), 15000);
        await waitForBodyText(driver, 'Create Note');

        await driver.findElement(By.id('title')).sendKeys(noteTitle);
        await driver.findElement(By.id('content')).sendKeys(noteContent);
        await driver.findElement(By.css('form[action="/notes"] button[type="submit"]')).click();

        await waitForLocationContains(driver, '/notes');
        await waitForBodyText(driver, noteTitle);
        await waitForBodyText(driver, noteContent);

        await driver.findElement(By.linkText('View')).click();
        await driver.wait(until.elementLocated(By.css('h1')), 15000);
        await waitForBodyText(driver, noteTitle);
        await waitForBodyText(driver, noteContent);

        await driver.findElement(By.css('a[href$="/edit"]')).click();
        await driver.wait(until.elementLocated(By.css('form[action^="/notes/"]')), 15000);
        await waitForBodyText(driver, 'Edit Note');

        const titleInput = await driver.findElement(By.id('title'));
        const contentInput = await driver.findElement(By.id('content'));
        await titleInput.clear();
        await titleInput.sendKeys(updatedTitle);
        await contentInput.clear();
        await contentInput.sendKeys(updatedContent);
        await driver.findElement(By.css('form[action^="/notes/"] button[type="submit"]')).click();

        await driver.wait(async () => {
            const currentUrl = new URL(await driver.getCurrentUrl());
            return /^\/notes\/[^/]+$/.test(currentUrl.pathname);
        }, 15000, 'Expected to land on the updated note detail page.');
        await waitForBodyText(driver, updatedTitle);
        await waitForBodyText(driver, updatedContent);

        await driver.findElement(By.css('a[href="/"]')).click();
        await waitForLocationContains(driver, '/notes');
        await waitForBodyText(driver, updatedTitle);

        await driver.findElement(By.css('.note-delete-button')).click();
        await acceptNextAlert(driver);
        await waitForLocationContains(driver, '/notes');
        await waitForBodyText(driver, 'No notes yet. Create your first note!');

        const notesBodyText = await getBodyText(driver);
        expect(notesBodyText).not.to.include(updatedTitle);
    });
});
