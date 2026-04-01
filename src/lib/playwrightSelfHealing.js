const locatorRepairResearchService = require('../services/locatorRepairResearchService');

function buildPlaywrightLocator(page, suggestion = {}) {
    const strategy = suggestion.primaryLocator && suggestion.primaryLocator.strategy;
    const candidate = suggestion.candidate || {};

    switch (strategy) {
        case 'data-testid':
            return page.getByTestId(candidate.dataTestId);
        case 'id':
            return page.locator(`[id=${JSON.stringify(candidate.id)}]`);
        case 'role-and-name':
            return page.getByRole(candidate.role, { name: candidate.accessibleName });
        case 'href':
            return page.locator(`a[href="${candidate.href}"]`);
        case 'name':
            return page.locator(`[name=${JSON.stringify(candidate.name)}]`);
        case 'placeholder':
            return page.getByPlaceholder(candidate.placeholder);
        case 'text':
            return page.getByText(candidate.text, { exact: true });
        default:
            return null;
    }
}

async function capturePlaywrightHtmlSnippet(page, selector = 'body', maxLength = 12000) {
    try {
        const html = await page.locator(selector).evaluate((element) => element.innerHTML);
        return String(html || '').slice(0, maxLength);
    } catch (_error) {
        const html = await page.content().catch(() => '');
        return String(html || '').slice(0, maxLength);
    }
}

function prioritizeSuggestions(suggestions = [], limit = 3) {
    const auto = suggestions.filter((suggestion) => suggestion.healDecision && suggestion.healDecision.autoApplyEligible);
    const reviewable = suggestions.filter((suggestion) => suggestion.primaryLocator && suggestion.healDecision && suggestion.healDecision.canVerify && !suggestion.healDecision.autoApplyEligible);

    return auto.concat(reviewable).slice(0, Math.max(1, limit));
}

async function resolveWithSelfHealing(page, options = {}) {
    if (typeof options.locate !== 'function') {
        throw new Error('resolveWithSelfHealing requires a locate() function that returns a Playwright Locator.');
    }

    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 2500;
    let originalError = null;

    try {
        const originalLocator = await Promise.resolve(options.locate());
        await originalLocator.waitFor({ state: 'visible', timeout: timeoutMs });
        return originalLocator;
    } catch (error) {
        originalError = error;
    }

    const htmlSnippet = await capturePlaywrightHtmlSnippet(
        page,
        options.htmlScopeSelector || 'body',
        Number.isFinite(Number(options.maxSnippetLength)) ? Number(options.maxSnippetLength) : 12000
    );
    const route = options.route || new URL(page.url()).pathname;
    const repairResult = locatorRepairResearchService.suggestLocatorRepairs({
        locator: options.locator,
        stepGoal: options.stepGoal || '',
        htmlSnippet
    });
    const candidates = prioritizeSuggestions(repairResult.suggestions, options.healLimit || 3);

    for (const suggestion of candidates) {
        const healedLocator = buildPlaywrightLocator(page, suggestion);
        if (!healedLocator) {
            continue;
        }

        try {
            await healedLocator.waitFor({ state: 'visible', timeout: timeoutMs });
            if (typeof options.verify === 'function') {
                const verified = await options.verify({
                    locator: healedLocator,
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
                framework: 'playwright',
                route,
                scenarioId: options.scenarioId || '',
                autoTrain: options.autoTrain !== false
            });

            return healedLocator;
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
    buildPlaywrightLocator,
    capturePlaywrightHtmlSnippet,
    resolveWithSelfHealing
};
