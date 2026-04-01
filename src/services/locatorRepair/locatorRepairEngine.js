const { predictLocatorRepairCandidate } = require('../../utils/locatorRepairModel');
const {
    AUTO_HEAL_STRATEGIES,
    DEFAULT_CONFIDENCE,
    SAMPLE_CASES
} = require('./locatorRepairCatalog');
const {
    extractInteractiveElements,
    normalizeComparable,
    parseLocatorSignals,
    tokenize
} = require('./locatorRepairParsing');

function countTokenOverlap(left = [], right = []) {
    if (!left.length || !right.length) {
        return 0;
    }

    const rightSet = new Set(right);
    return left.filter((token) => rightSet.has(token)).length;
}

function addReason(reasons, message) {
    if (!reasons.includes(message)) {
        reasons.push(message);
    }
}

function isTextDrivenLocator(signals = {}) {
    return ['selenium-link-text', 'playwright-text'].includes(signals.family)
        || (signals.family === 'playwright-role' && Boolean(signals.text));
}

function countStableSignals(candidate = {}) {
    return [
        candidate.dataTestId,
        candidate.id,
        candidate.href,
        candidate.name,
        candidate.placeholder
    ].filter((value) => Boolean(String(value || '').trim())).length;
}

function scoreCandidate(candidate, originalSignals, stepTokens) {
    const reasons = [];
    let score = 0;

    if (originalSignals.dataTestId && candidate.dataTestId === originalSignals.dataTestId) {
        score += 150;
        addReason(reasons, `Matched the original data-testid "${originalSignals.dataTestId}".`);
    }

    if (originalSignals.id && candidate.id === originalSignals.id) {
        score += 130;
        addReason(reasons, `Matched the original id "${originalSignals.id}".`);
    }

    if (originalSignals.href && candidate.href === originalSignals.href) {
        score += 120;
        addReason(reasons, `Matched the original href "${originalSignals.href}".`);
    }

    if (originalSignals.name && candidate.name === originalSignals.name) {
        score += 100;
        addReason(reasons, `Matched the original name "${originalSignals.name}".`);
    }

    if (originalSignals.placeholder && candidate.placeholder === originalSignals.placeholder) {
        score += 90;
        addReason(reasons, `Matched the original placeholder "${originalSignals.placeholder}".`);
    }

    const originalText = normalizeComparable(originalSignals.text);
    const candidateText = normalizeComparable(candidate.text);
    if (originalText && candidateText && originalText === candidateText) {
        score += 85;
        addReason(reasons, 'Matched the original visible text exactly.');
    }

    if (originalSignals.role && candidate.role && originalSignals.role === candidate.role) {
        score += 25;
        addReason(reasons, `Matched the original role "${originalSignals.role}".`);
    }

    if (originalSignals.tag && candidate.tag && originalSignals.tag === candidate.tag) {
        score += 15;
    }

    const originalTokens = Array.isArray(originalSignals.tokens) ? originalSignals.tokens : [];
    const candidateTokens = Array.isArray(candidate.tokens) ? candidate.tokens : [];
    const originalOverlap = countTokenOverlap(originalTokens, candidateTokens);
    const stepOverlap = countTokenOverlap(stepTokens, candidateTokens);

    if (originalOverlap > 0) {
        score += Math.min(50, originalOverlap * 12);
        addReason(reasons, `Shared ${originalOverlap} token(s) with the original locator intent.`);
    }

    if (stepOverlap > 0) {
        score += Math.min(45, stepOverlap * 9);
        addReason(reasons, `Shared ${stepOverlap} token(s) with the step goal.`);
    }

    if (candidate.dataTestId) {
        score += 35;
        addReason(reasons, `Candidate exposes stable data-testid "${candidate.dataTestId}".`);
    }

    if (candidate.id) {
        score += 30;
        addReason(reasons, `Candidate exposes stable id "${candidate.id}".`);
    }

    if (candidate.href && candidate.role === 'link') {
        score += 25;
        addReason(reasons, `Candidate exposes stable href "${candidate.href}".`);
    }

    if (candidate.name) {
        score += 20;
        addReason(reasons, `Candidate exposes semantic name "${candidate.name}".`);
    }

    if (candidate.role && candidate.accessibleName) {
        score += 12;
    }

    if (isTextDrivenLocator(originalSignals) && candidate.dataTestId) {
        score += 18;
        addReason(reasons, 'Upgrades the repair from a text-driven locator to a dedicated automation attribute.');
    }

    if (isTextDrivenLocator(originalSignals) && (candidate.id || candidate.name) && !candidate.dataTestId) {
        score += 10;
        addReason(reasons, 'Upgrades the repair from a text-driven locator to an id-or-name based strategy.');
    }

    if (!candidate.dataTestId && !candidate.id && !candidate.href && !candidate.name && !candidate.placeholder && !candidate.text) {
        score -= 20;
    }

    return {
        score,
        reasons,
        originalOverlap,
        stepOverlap,
        stableSignalCount: countStableSignals(candidate)
    };
}

function quoteJs(value) {
    return JSON.stringify(String(value));
}

function buildAttributeSelector(attributeName, value) {
    return `[${attributeName}=${quoteJs(value)}]`;
}

function escapeXpathLiteral(value = '') {
    const stringValue = String(value);

    if (!stringValue.includes('\'')) {
        return `'${stringValue}'`;
    }

    if (!stringValue.includes('"')) {
        return `"${stringValue}"`;
    }

    return `concat(${stringValue.split('\'').map((segment) => `'${segment}'`).join(', "\'", ')})`;
}

function buildLocatorAlternatives(candidate) {
    const alternatives = [];
    const seen = new Set();

    function pushAlternative(strategy, stability, playwrightLocator, seleniumLocator) {
        const dedupeKey = `${playwrightLocator}::${seleniumLocator}`;
        if (seen.has(dedupeKey)) {
            return;
        }

        seen.add(dedupeKey);
        alternatives.push({
            strategy,
            stability,
            playwright: playwrightLocator,
            selenium: seleniumLocator
        });
    }

    if (candidate.dataTestId) {
        pushAlternative(
            'data-testid',
            'highest',
            `page.getByTestId(${quoteJs(candidate.dataTestId)})`,
            `By.css(${quoteJs(buildAttributeSelector('data-testid', candidate.dataTestId))})`
        );
    }

    if (candidate.id) {
        pushAlternative(
            'id',
            'high',
            `page.locator(${quoteJs(buildAttributeSelector('id', candidate.id))})`,
            `By.id(${quoteJs(candidate.id)})`
        );
    }

    if (candidate.role && candidate.accessibleName) {
        const accessibleName = candidate.accessibleName.trim();
        const playwrightLocator = `page.getByRole(${quoteJs(candidate.role)}, { name: ${quoteJs(accessibleName)} })`;
        const seleniumLocator = candidate.role === 'link'
            ? `By.linkText(${quoteJs(accessibleName)})`
            : `By.xpath(${quoteJs(`//${candidate.tag}[normalize-space()=${escapeXpathLiteral(accessibleName)}]`)})`;

        pushAlternative('role-and-name', 'medium', playwrightLocator, seleniumLocator);
    }

    if (candidate.href && candidate.tag === 'a') {
        const selector = `a[href="${candidate.href}"]`;
        pushAlternative(
            'href',
            'high',
            `page.locator(${quoteJs(selector)})`,
            `By.css(${quoteJs(selector)})`
        );
    }

    if (candidate.name) {
        pushAlternative(
            'name',
            'medium',
            `page.locator(${quoteJs(buildAttributeSelector('name', candidate.name))})`,
            `By.name(${quoteJs(candidate.name)})`
        );
    }

    if (candidate.placeholder) {
        pushAlternative(
            'placeholder',
            'medium',
            `page.getByPlaceholder(${quoteJs(candidate.placeholder)})`,
            `By.css(${quoteJs(buildAttributeSelector('placeholder', candidate.placeholder))})`
        );
    }

    if (candidate.text) {
        const textValue = candidate.text.trim();
        const seleniumLocator = candidate.role === 'link'
            ? `By.linkText(${quoteJs(textValue)})`
            : `By.xpath(${quoteJs(`//*[normalize-space()=${escapeXpathLiteral(textValue)}]`)})`;

        pushAlternative(
            'text',
            'low',
            `page.getByText(${quoteJs(textValue)}, { exact: true })`,
            seleniumLocator
        );
    }

    return alternatives;
}

function normalizeHeuristicScore(score) {
    const normalized = (Number(score) + 20) / 220;
    return Math.max(0, Math.min(normalized, 1));
}

function classifyConfidence(score) {
    if (score >= 0.82) {
        return 'high';
    }

    if (score >= 0.62) {
        return 'medium';
    }

    return DEFAULT_CONFIDENCE;
}

function buildDetectedSignals(signals = {}) {
    const entries = [
        ['Locator family', signals.family],
        ['Role', signals.role],
        ['Tag', signals.tag],
        ['Visible text', signals.text],
        ['id', signals.id],
        ['data-testid', signals.dataTestId],
        ['href', signals.href],
        ['name', signals.name],
        ['placeholder', signals.placeholder]
    ];

    return entries
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([label, value]) => ({ label, value }));
}

function buildCandidateFingerprint(candidate = {}) {
    return JSON.stringify({
        tag: candidate.tag || '',
        role: candidate.role || '',
        text: normalizeComparable(candidate.text),
        accessibleName: normalizeComparable(candidate.accessibleName),
        id: candidate.id || '',
        dataTestId: candidate.dataTestId || '',
        href: candidate.href || '',
        name: candidate.name || '',
        placeholder: candidate.placeholder || ''
    });
}

function buildCandidateSummary(candidate) {
    return {
        fingerprint: buildCandidateFingerprint(candidate),
        tag: candidate.tag,
        role: candidate.role || 'none',
        text: candidate.text || '',
        accessibleName: candidate.accessibleName || '',
        id: candidate.id || '',
        dataTestId: candidate.dataTestId || '',
        href: candidate.href || '',
        name: candidate.name || '',
        placeholder: candidate.placeholder || ''
    };
}

function buildLearningFeatures({ candidate, originalSignals, scored }) {
    const originalFamily = String(originalSignals.family || '');
    const normalizedText = normalizeComparable(originalSignals.text);
    const normalizedCandidateText = normalizeComparable(candidate.text);

    return {
        heuristicScoreNorm: normalizeHeuristicScore(scored.score),
        candidateHasDataTestId: Boolean(candidate.dataTestId),
        candidateHasId: Boolean(candidate.id),
        candidateHasHref: Boolean(candidate.href),
        candidateHasName: Boolean(candidate.name),
        candidateHasPlaceholder: Boolean(candidate.placeholder),
        candidateHasAccessibleName: Boolean(candidate.accessibleName),
        candidateHasText: Boolean(candidate.text),
        candidateRoleLink: candidate.role === 'link',
        candidateRoleButton: candidate.role === 'button',
        candidateRoleTextbox: candidate.role === 'textbox',
        originalFamilyText: ['selenium-link-text', 'playwright-text'].includes(originalFamily),
        originalFamilyRole: originalFamily === 'playwright-role',
        originalFamilyCss: ['playwright-css', 'selenium-css'].includes(originalFamily),
        originalFamilyId: originalFamily === 'selenium-id',
        originalFamilyName: originalFamily === 'selenium-name',
        originalFamilyPlaceholder: originalFamily === 'playwright-placeholder',
        exactDataTestIdMatch: Boolean(originalSignals.dataTestId && candidate.dataTestId === originalSignals.dataTestId),
        exactIdMatch: Boolean(originalSignals.id && candidate.id === originalSignals.id),
        exactHrefMatch: Boolean(originalSignals.href && candidate.href === originalSignals.href),
        exactNameMatch: Boolean(originalSignals.name && candidate.name === originalSignals.name),
        exactPlaceholderMatch: Boolean(originalSignals.placeholder && candidate.placeholder === originalSignals.placeholder),
        exactTextMatch: Boolean(normalizedText && normalizedCandidateText && normalizedText === normalizedCandidateText),
        roleMatch: Boolean(originalSignals.role && candidate.role && originalSignals.role === candidate.role),
        tagMatch: Boolean(originalSignals.tag && candidate.tag && originalSignals.tag === candidate.tag),
        originalOverlap: scored.originalOverlap,
        stepOverlap: scored.stepOverlap,
        stableSignalCount: scored.stableSignalCount,
        upgradeTextToDataTestId: isTextDrivenLocator(originalSignals) && Boolean(candidate.dataTestId),
        upgradeTextToIdOrName: isTextDrivenLocator(originalSignals) && Boolean(candidate.id || candidate.name),
        candidateTextLength: String(candidate.accessibleName || candidate.text || '').trim().length
    };
}

function candidateMatchesExpected(candidate, expected = {}) {
    const entries = Object.entries(expected);
    if (entries.length === 0) {
        return false;
    }

    return entries.every(([key, value]) => normalizeComparable(candidate[key]) === normalizeComparable(value));
}

function buildBootstrapTrainingExamples() {
    return SAMPLE_CASES.flatMap((sample) => {
        const originalSignals = parseLocatorSignals(sample.originalLocator);
        const stepTokens = Array.from(new Set([
            ...tokenize(sample.stepGoal),
            ...originalSignals.tokens
        ]));
        const candidates = extractInteractiveElements(sample.htmlSnippet);

        return candidates.map((candidate) => {
            const scored = scoreCandidate(candidate, originalSignals, stepTokens);
            const label = candidateMatchesExpected(candidate, sample.expectedCandidate) ? 1 : 0;

            return {
                label,
                weight: label === 1 ? 2.6 : 1,
                source: `sample:${sample.id}`,
                features: buildLearningFeatures({
                    candidate,
                    originalSignals,
                    scored
                })
            };
        });
    });
}

function buildHistoryTrainingExamples(entries = []) {
    return entries.flatMap((entry) => {
        if (!entry || !entry.request || !entry.request.locator || !entry.request.htmlSnippet) {
            return [];
        }

        const originalSignals = parseLocatorSignals(entry.request.locator);
        const stepTokens = Array.from(new Set([
            ...tokenize(entry.request.stepGoal || ''),
            ...originalSignals.tokens
        ]));
        const candidates = extractInteractiveElements(entry.request.htmlSnippet);

        return candidates.flatMap((candidate) => {
            const fingerprint = buildCandidateFingerprint(candidate);
            let label = null;

            if (['accepted', 'healed'].includes(entry.feedbackLabel)) {
                label = fingerprint === entry.selectedFingerprint ? 1 : 0;
            } else if (entry.feedbackLabel === 'rejected' && fingerprint === entry.selectedFingerprint) {
                label = 0;
            }

            if (label === null) {
                return [];
            }

            const scored = scoreCandidate(candidate, originalSignals, stepTokens);
            const positiveWeight = entry.feedbackLabel === 'healed' ? 3.2 : 2.4;
            const negativeWeight = entry.feedbackLabel === 'rejected' ? 1.7 : 0.9;

            return [{
                label,
                weight: label === 1 ? positiveWeight : negativeWeight,
                source: `feedback:${entry.feedbackLabel}`,
                features: buildLearningFeatures({
                    candidate,
                    originalSignals,
                    scored
                })
            }];
        });
    });
}

function buildFallbackSuggestion(originalSignals, modelSummary) {
    return {
        rank: 1,
        score: 0,
        heuristicScore: 0,
        confidence: 'low',
        candidate: {
            fingerprint: '',
            tag: '',
            role: '',
            text: '',
            accessibleName: '',
            id: '',
            dataTestId: '',
            href: '',
            name: '',
            placeholder: ''
        },
        primaryLocator: {
            strategy: 'add-data-testid',
            stability: 'highest',
            playwright: 'page.getByTestId("choose-a-stable-id")',
            selenium: 'By.css(\'[data-testid="choose-a-stable-id"]\')'
        },
        alternativeLocators: [],
        reasons: [
            'No strong interactive candidate was detected in the supplied HTML snippet.',
            'Add a dedicated data-testid to the intended element, then rerun the failing step with a deterministic assertion.'
        ],
        sourceLocatorFamily: originalSignals.family,
        ml: {
            available: modelSummary.available,
            score: 0,
            label: 'low',
            reasons: ['No candidate was available for the trained reranker to evaluate.'],
            scoreSource: modelSummary.scoreSource || 'heuristic-only'
        },
        hybrid: {
            score: 0
        },
        healDecision: {
            canVerify: false,
            stableStrategy: false,
            autoApplyEligible: false,
            margin: 0,
            reason: 'No concrete candidate was found, so self-healing is not possible yet.'
        }
    };
}

function buildSuggestionResult(candidate, originalSignals, stepTokens, modelState) {
    const scored = scoreCandidate(candidate, originalSignals, stepTokens);
    const alternatives = buildLocatorAlternatives(candidate);
    const primaryLocator = alternatives[0];
    const learningFeatures = buildLearningFeatures({
        candidate,
        originalSignals,
        scored
    });
    const mlPrediction = modelState.model
        ? predictLocatorRepairCandidate(learningFeatures, modelState.model)
        : null;
    const heuristicScoreNorm = normalizeHeuristicScore(scored.score);
    const hybridScore = mlPrediction
        ? Number(((heuristicScoreNorm * 0.42) + (mlPrediction.score * 0.58)).toFixed(3))
        : Number(heuristicScoreNorm.toFixed(3));

    return {
        score: Number((hybridScore * 100).toFixed(1)),
        heuristicScore: scored.score,
        confidence: classifyConfidence(hybridScore),
        candidate: buildCandidateSummary(candidate),
        primaryLocator,
        alternativeLocators: alternatives.slice(1),
        reasons: scored.reasons,
        sourceLocatorFamily: originalSignals.family,
        ml: {
            available: Boolean(mlPrediction),
            score: mlPrediction ? mlPrediction.score : 0,
            label: mlPrediction ? mlPrediction.label : 'low',
            reasons: mlPrediction ? mlPrediction.reasons : [],
            scoreSource: modelState.summary.scoreSource || 'heuristic-only'
        },
        hybrid: {
            score: hybridScore
        },
        learningFeatures
    };
}

function applyHealDecisions(suggestions = []) {
    return suggestions.map((suggestion, index) => {
        const nextSuggestion = suggestions[index + 1];
        const stableStrategy = AUTO_HEAL_STRATEGIES.has(suggestion.primaryLocator && suggestion.primaryLocator.strategy);
        const margin = Number((
            (suggestion.hybrid && suggestion.hybrid.score ? suggestion.hybrid.score : 0) -
            (nextSuggestion && nextSuggestion.hybrid && nextSuggestion.hybrid.score ? nextSuggestion.hybrid.score : 0)
        ).toFixed(3));
        const autoApplyEligible = Boolean(suggestion.primaryLocator)
            && stableStrategy
            && suggestion.ml
            && suggestion.ml.available
            && Number(suggestion.ml.score || 0) >= 0.62
            && Number(suggestion.hybrid && suggestion.hybrid.score || 0) >= 0.72
            && margin >= 0.08;
        const reason = autoApplyEligible
            ? 'This repair is strong enough to try at runtime, but only behind a deterministic verification step.'
            : stableStrategy
                ? 'This repair can be verified, but the confidence or separation from nearby candidates is not high enough for automatic healing.'
                : 'This repair is still reviewable, but its locator strategy is too brittle for automatic self-healing.';

        return {
            ...suggestion,
            healDecision: {
                canVerify: Boolean(suggestion.primaryLocator),
                stableStrategy,
                autoApplyEligible,
                margin,
                reason
            }
        };
    });
}

module.exports = {
    applyHealDecisions,
    buildBootstrapTrainingExamples,
    buildCandidateFingerprint,
    buildDetectedSignals,
    buildFallbackSuggestion,
    buildHistoryTrainingExamples,
    buildSuggestionResult
};
