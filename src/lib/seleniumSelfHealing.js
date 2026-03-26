const { By, until } = require('selenium-webdriver');

const locatorRepairResearchService = require('../services/locatorRepairResearchService');

function buildSeleniumBy(suggestion = {}) {
    const strategy = suggestion.primaryLocator && suggestion.primaryLocator.strategy;
    const candidate = suggestion.candidate || {};

    switch (strategy) {
        case 'data-testid':
            return By.css(`[data-testid=${JSON.stringify(candidate.dataTestId)}]`);
        case 'id':
            return By.id(candidate.id);
        case 'role-and-name':
            return candidate.role === 'link'
                ? By.linkText(candidate.accessibleName)
                : By.xpath(`//${candidate.tag}[normalize-space()=${JSON.stringify(candidate.accessibleName)}]`);
        case 'href':
            return By.css(`a[href="${candidate.href}"]`);
        case 'name':
            return By.name(candidate.name);
        case 'placeholder':
            return By.css(`[placeholder=${JSON.stringify(candidate.placeholder)}]`);
        case 'text':
            return candidate.role === 'link'
                ? By.linkText(candidate.text)
                : By.xpath(`//*[normalize-space()=${JSON.stringify(candidate.text)}]`);
        default:
            return null;
    }
}

async function captureSeleniumHtmlSnippet(driver, selector = 'body', maxLength = 12000) {
    try {
        const html = await driver.findElement(By.css(selector)).getAttribute('innerHTML');
        return String(html || '').slice(0, maxLength);
    } catch (_error) {
        const html = await driver.findElement(By.css('body')).getAttribute('innerHTML').catch(() => '');
        return String(html || '').slice(0, maxLength);
    }
}

function prioritizeSuggestions(suggestions = [], limit = 3) {
    const auto = suggestions.filter((suggestion) => suggestion.healDecision && suggestion.healDecision.autoApplyEligible);
    const reviewable = suggestions.filter((suggestion) => suggestion.primaryLocator && suggestion.healDecision && suggestion.healDecision.canVerify && !suggestion.healDecision.autoApplyEligible);

    return auto.concat(reviewable).slice(0, Math.max(1, limit));
}

async function findWithSelfHealing(driver, options = {}) {
    if (typeof options.find !== 'function') {
        throw new Error('findWithSelfHealing requires a find() function that returns a Selenium WebElement promise.');
    }

    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 2500;
    let originalError = null;

    try {
        const originalElement = await Promise.resolve(options.find());
        if (originalElement && typeof originalElement.isDisplayed === 'function') {
            await originalElement.isDisplayed();
        }
        return originalElement;
    } catch (error) {
        originalError = error;
    }

    const htmlSnippet = await captureSeleniumHtmlSnippet(
        driver,
        options.htmlScopeSelector || 'body',
        Number.isFinite(Number(options.maxSnippetLength)) ? Number(options.maxSnippetLength) : 12000
    );
    const currentUrl = await driver.getCurrentUrl().catch(() => '');
    const route = options.route || (currentUrl ? new URL(currentUrl).pathname : '');
    const repairResult = locatorRepairResearchService.suggestLocatorRepairs({
        locator: options.locator,
        stepGoal: options.stepGoal || '',
        htmlSnippet
    });
    const candidates = prioritizeSuggestions(repairResult.suggestions, options.healLimit || 3);

    for (const suggestion of candidates) {
        const healedBy = buildSeleniumBy(suggestion);
        if (!healedBy) {
            continue;
        }

        try {
            const healedElement = await driver.wait(until.elementLocated(healedBy), timeoutMs);
            if (typeof options.verify === 'function') {
                const verified = await options.verify({
                    element: healedElement,
                    by: healedBy,
                    suggestion,
                    repairResult
                });

                if (verified === false) {
                    throw new Error('Deterministic verification returned false.');
                }
            }

            locatorRepairResearchService.recordLocatorRepairFeedback({
                locator: options.locator,
                stepGoal: options.stepGoal || '',
                htmlSnippet,
                selectedFingerprint: suggestion.candidate && suggestion.candidate.fingerprint ? suggestion.candidate.fingerprint : '',
                feedbackLabel: 'healed',
                verified: true,
                framework: 'selenium',
                route,
                scenarioId: options.scenarioId || '',
                autoTrain: options.autoTrain !== false
            });

            return healedElement;
        } catch (_healError) {
            continue;
        }
    }

    const detail = repairResult.suggestions[0] && repairResult.suggestions[0].healDecision
        ? repairResult.suggestions[0].healDecision.reason
        : 'No verified self-heal candidate was available.';
    throw new Error(`Original locator failed and no self-heal candidate verified. ${detail} Original error: ${originalError ? originalError.message : 'unknown failure'}`);
}

module.exports = {
    buildSeleniumBy,
    captureSeleniumHtmlSnippet,
    findWithSelfHealing
};
