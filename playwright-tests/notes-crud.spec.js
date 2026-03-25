const { test, expect } = require('@playwright/test');
const { getPlaywrightScenario } = require('../src/lib/playwrightScenarioRegistry');
const { createAuthenticatedSession } = require('./helpers/auth');

function annotateScenario(testInfo, scenario) {
    testInfo.annotations.push({ type: 'playwright-scenario', description: scenario.id });
}

test.describe('Notes CRUD browser coverage', () => {
    test(getPlaywrightScenario('notes-crud-workflow').title, async ({ page }, testInfo) => {
        annotateScenario(testInfo, getPlaywrightScenario('notes-crud-workflow'));
        const credentials = await createAuthenticatedSession(page, testInfo);
        const noteTitle = `Playwright note ${testInfo.parallelIndex}`;
        const noteContent = `Created by ${credentials.email} during browser CRUD coverage.`;
        const updatedTitle = `${noteTitle} updated`;
        const updatedContent = 'Updated through the server-rendered edit form.';

        await page.goto('/notes/new');
        await expect(page).toHaveURL(/\/notes\/new$/);
        await expect(page.getByRole('heading', { name: 'Create Note' })).toBeVisible();

        await page.locator('#title').fill(noteTitle);
        await page.locator('#content').fill(noteContent);
        await page.locator('#image').fill('');

        await Promise.all([
            page.waitForURL(/\/notes$/),
            page.getByRole('button', { name: 'Create Note' }).click()
        ]);

        await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
        await expect(page.locator('body')).toContainText(noteTitle);
        await expect(page.locator('body')).toContainText(noteContent);

        await page.getByRole('link', { name: 'View' }).click();
        await expect(page.getByRole('heading', { name: noteTitle })).toBeVisible();
        await expect(page.locator('body')).toContainText(noteContent);

        await page.getByRole('link', { name: /Edit/ }).click();
        await expect(page).toHaveURL(/\/notes\/.+\/edit$/);
        await expect(page.getByRole('heading', { name: 'Edit Note' })).toBeVisible();

        await page.locator('#title').fill(updatedTitle);
        await page.locator('#content').fill(updatedContent);

        await Promise.all([
            page.waitForURL(/\/notes\/.+$/),
            page.getByRole('button', { name: 'Update Note' }).click()
        ]);

        await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();
        await expect(page.locator('body')).toContainText(updatedContent);

        await page.getByRole('link', { name: /Back/ }).click();
        await expect(page).toHaveURL(/\/notes$/);
        await expect(page.locator('body')).toContainText(updatedTitle);

        page.once('dialog', (dialog) => dialog.accept());
        await Promise.all([
            page.waitForURL(/\/notes$/),
            page.getByRole('button', { name: 'Delete' }).click()
        ]);

        await expect(page.locator('body')).toContainText('No notes yet. Create your first note!');
        await expect(page.locator('body')).not.toContainText(updatedTitle);
    });
});
