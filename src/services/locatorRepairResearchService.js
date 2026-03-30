const {
    ALLOWED_FEEDBACK_LABELS,
    appendLocatorRepairHistoryEntry,
    loadLocatorRepairHistory,
    resolveLocatorRepairHistoryPath,
    summarizeLocatorRepairHistory
} = require('../utils/locatorRepairHistoryStore');
const {
    clearLocatorRepairModelCache,
    loadLocatorRepairModel,
    resolveLocatorRepairModelPath,
    saveLocatorRepairModel,
    trainLocatorRepairModel
} = require('../utils/locatorRepairModel');
const {
    CONTROL_DEFINITIONS,
    DEFAULT_ENGINE_MODE,
    DEFAULT_ENGINE_NOTE,
    DEFAULT_SAMPLE_ID,
    REPAIR_LADDER,
    SAMPLE_CASES,
    SUPPORTED_LOCATOR_FAMILIES,
    SUPPORTED_SIGNALS,
    WORKFLOW,
    getSampleCase,
    getSampleCaseIds,
    normalizeBaseUrl
} = require('./locatorRepair/locatorRepairCatalog');
const {
    extractInteractiveElements,
    parseLocatorSignals,
    tokenize
} = require('./locatorRepair/locatorRepairParsing');
const {
    applyHealDecisions,
    buildBootstrapTrainingExamples,
    buildCandidateFingerprint,
    buildDetectedSignals,
    buildFallbackSuggestion,
    buildHistoryTrainingExamples,
    buildSuggestionResult
} = require('./locatorRepair/locatorRepairEngine');

let cachedBootstrapModel = null;

function buildModelSummary(model, options = {}) {
    if (!model) {
        return {
            available: false,
            source: 'none',
            path: resolveLocatorRepairModelPath(options.modelPath),
            modelType: 'logistic-regression',
            scoreSource: 'heuristic-only',
            trainedAt: null,
            trainingSamples: 0,
            positiveSamples: 0,
            negativeSamples: 0,
            metrics: {}
        };
    }

    return {
        available: true,
        source: options.source || 'persisted',
        path: options.source === 'persisted'
            ? resolveLocatorRepairModelPath(options.modelPath)
            : 'in-memory bootstrap',
        modelType: model.modelType || 'logistic-regression',
        scoreSource: model.scoreSource || 'trained-locator-repair-logistic-regression',
        trainedAt: model.trainedAt || null,
        trainingSamples: Number(model.trainingSamples) || 0,
        positiveSamples: Number(model.positiveSamples) || 0,
        negativeSamples: Number(model.negativeSamples) || 0,
        metrics: model.metrics && typeof model.metrics === 'object'
            ? model.metrics
            : {}
    };
}

function getRuntimeModelState(options = {}) {
    const persistedModel = loadLocatorRepairModel({ modelPath: options.modelPath });
    if (persistedModel) {
        return {
            model: persistedModel,
            summary: buildModelSummary(persistedModel, {
                source: 'persisted',
                modelPath: options.modelPath
            })
        };
    }

    if (!cachedBootstrapModel) {
        cachedBootstrapModel = trainLocatorRepairModel(buildBootstrapTrainingExamples(), {
            learningRate: 0.34,
            epochs: 520
        });
    }

    return {
        model: cachedBootstrapModel,
        summary: buildModelSummary(cachedBootstrapModel, {
            source: 'bootstrap',
            modelPath: options.modelPath
        })
    };
}

function getLocatorRepairHistory(options = {}) {
    const history = loadLocatorRepairHistory({ historyPath: options.historyPath });
    const summary = summarizeLocatorRepairHistory(history, {
        limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8
    });

    return {
        path: resolveLocatorRepairHistoryPath(options.historyPath),
        summary,
        entries: summary.recentEntries
    };
}

function buildLocatorRepairModuleOverview({ baseUrl, modelPath, historyPath } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const modelState = getRuntimeModelState({ modelPath });
    const history = getLocatorRepairHistory({ historyPath, limit: 8 });

    return {
        module: {
            name: 'Self-Healing Locator Repair Module',
            runtime: DEFAULT_ENGINE_MODE,
            targetFrameworks: 'Playwright and Selenium',
            exportStyle: 'Ranked self-healing suggestions and runtime self-heal helpers',
            baseUrl: normalizedBaseUrl,
            engineNote: DEFAULT_ENGINE_NOTE
        },
        coverage: {
            sampleCaseCount: SAMPLE_CASES.length,
            supportedLocatorFamilyCount: SUPPORTED_LOCATOR_FAMILIES.length,
            outputTargetCount: 2,
            feedbackEntryCount: history.summary.totalEntries,
            verifiedHealCount: history.summary.healedCount
        },
        controls: CONTROL_DEFINITIONS.map((control) => ({ ...control })),
        workflow: WORKFLOW.map((item) => ({ ...item })),
        repairLadder: REPAIR_LADDER.map((item) => ({ ...item })),
        supportedSignals: SUPPORTED_SIGNALS.map((item) => ({ ...item })).slice(0, 8),
        sampleCases: SAMPLE_CASES.map((sample) => ({
            id: sample.id,
            title: sample.title,
            summary: sample.summary,
            originalLocator: sample.originalLocator,
            stepGoal: sample.stepGoal,
            htmlSnippet: sample.htmlSnippet
        })),
        supportedLocatorFamilies: [...SUPPORTED_LOCATOR_FAMILIES],
        defaultSampleId: DEFAULT_SAMPLE_ID,
        generatedAt: new Date().toISOString(),
        model: modelState.summary,
        history: history.summary,
        runtimeHelpers: {
            playwright: 'src/lib/playwrightSelfHealing.js',
            selenium: 'src/lib/seleniumSelfHealing.js'
        }
    };
}

function suggestLocatorRepairs({ locator, stepGoal = '', htmlSnippet = '', modelPath } = {}) {
    const originalSignals = parseLocatorSignals(locator);
    const candidates = extractInteractiveElements(htmlSnippet);
    const stepTokens = Array.from(new Set([
        ...tokenize(stepGoal),
        ...originalSignals.tokens
    ]));
    const modelState = getRuntimeModelState({ modelPath });
    const warnings = Array.from(new Set([
        ...(Array.isArray(originalSignals.warnings) ? originalSignals.warnings : [])
    ]));

    if (!String(htmlSnippet || '').trim()) {
        warnings.push('No HTML snippet was provided, so only generic repair guidance is available.');
    }

    if (!candidates.length && String(htmlSnippet || '').trim()) {
        warnings.push('No interactive elements were detected in the supplied HTML snippet.');
    }

    let suggestions = candidates
        .map((candidate) => buildSuggestionResult(candidate, originalSignals, stepTokens, modelState))
        .filter((result) => result.primaryLocator && (result.heuristicScore > 25 || Number(result.hybrid.score || 0) >= 0.45))
        .sort((left, right) => {
            const hybridDelta = Number(right.hybrid && right.hybrid.score || 0) - Number(left.hybrid && left.hybrid.score || 0);
            if (hybridDelta !== 0) {
                return hybridDelta;
            }

            return Number(right.heuristicScore || 0) - Number(left.heuristicScore || 0);
        })
        .slice(0, 5)
        .map((result, index) => ({
            ...result,
            rank: index + 1
        }));

    suggestions = suggestions.length
        ? applyHealDecisions(suggestions)
        : [buildFallbackSuggestion(originalSignals, modelState.summary)];

    return {
        engine: {
            mode: DEFAULT_ENGINE_MODE,
            note: DEFAULT_ENGINE_NOTE,
            deterministicVerificationRequired: true,
            model: modelState.summary
        },
        input: {
            locator: String(locator || ''),
            stepGoal: String(stepGoal || ''),
            htmlSnippetLength: String(htmlSnippet || '').length
        },
        analysis: {
            locatorFamily: originalSignals.family,
            detectedSignals: buildDetectedSignals(originalSignals),
            candidateCount: candidates.length,
            warnings,
            autoHealReadyCount: suggestions.filter((suggestion) => suggestion.healDecision && suggestion.healDecision.autoApplyEligible).length
        },
        suggestions,
        generatedAt: new Date().toISOString()
    };
}

function trainAndPersistLocatorRepairModel(options = {}) {
    const mode = typeof options.mode === 'string' && options.mode.trim()
        ? options.mode.trim().toLowerCase()
        : 'hybrid';
    const safeMode = ['bootstrap', 'hybrid'].includes(mode) ? mode : 'hybrid';
    const bootstrapExamples = buildBootstrapTrainingExamples();
    const history = loadLocatorRepairHistory({ historyPath: options.historyPath });
    const historyExamples = safeMode === 'bootstrap'
        ? []
        : buildHistoryTrainingExamples(history.entries);
    const allExamples = safeMode === 'bootstrap'
        ? bootstrapExamples
        : bootstrapExamples.concat(historyExamples);
    const model = trainLocatorRepairModel(allExamples, {
        learningRate: safeMode === 'bootstrap' ? 0.34 : 0.31,
        epochs: safeMode === 'bootstrap' ? 520 : 440
    });
    const savedPath = saveLocatorRepairModel(model, { modelPath: options.modelPath });

    cachedBootstrapModel = null;
    clearLocatorRepairModelCache();

    return {
        mode: safeMode,
        savedPath,
        bootstrapExamples: bootstrapExamples.length,
        historyExamples: historyExamples.length,
        feedbackEntries: history.entries.length,
        labels: {
            positive: allExamples.filter((example) => Number(example.label) > 0).length,
            negative: allExamples.filter((example) => Number(example.label) <= 0).length
        },
        sources: model.sources || {},
        model: buildModelSummary(model, {
            source: 'persisted',
            modelPath: options.modelPath
        }),
        history: summarizeLocatorRepairHistory(history, {
            limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 8
        })
    };
}

function findSelectedSuggestion(suggestions = [], options = {}) {
    if (options.selectedFingerprint) {
        return suggestions.find((suggestion) => suggestion.candidate && suggestion.candidate.fingerprint === options.selectedFingerprint) || null;
    }

    if (Number.isFinite(Number(options.suggestionRank)) && Number(options.suggestionRank) > 0) {
        return suggestions.find((suggestion) => suggestion.rank === Number(options.suggestionRank)) || null;
    }

    return suggestions[0] || null;
}

function recordLocatorRepairFeedback({
    locator,
    stepGoal = '',
    htmlSnippet = '',
    selectedFingerprint = '',
    suggestionRank = 1,
    feedbackLabel = 'accepted',
    verified = false,
    framework = '',
    route = '',
    scenarioId = '',
    notes = '',
    modelPath,
    historyPath,
    autoTrain = true
} = {}) {
    const safeFeedbackLabel = ALLOWED_FEEDBACK_LABELS.includes(feedbackLabel)
        ? feedbackLabel
        : 'accepted';
    const suggestionResult = suggestLocatorRepairs({
        locator,
        stepGoal,
        htmlSnippet,
        modelPath
    });
    const selectedSuggestion = findSelectedSuggestion(suggestionResult.suggestions, {
        selectedFingerprint,
        suggestionRank
    });

    if (!selectedSuggestion) {
        throw new Error('The selected suggestion could not be found in the current repair results.');
    }

    const entry = appendLocatorRepairHistoryEntry({
        feedbackLabel: safeFeedbackLabel,
        verified: safeFeedbackLabel === 'healed' ? true : Boolean(verified),
        framework,
        route,
        scenarioId,
        locatorFamily: suggestionResult.analysis.locatorFamily,
        selectedRank: selectedSuggestion.rank,
        selectedFingerprint: selectedSuggestion.candidate && selectedSuggestion.candidate.fingerprint
            ? selectedSuggestion.candidate.fingerprint
            : selectedFingerprint,
        request: {
            locator: String(locator || ''),
            stepGoal: String(stepGoal || ''),
            htmlSnippet: String(htmlSnippet || '')
        },
        selectedCandidate: selectedSuggestion.candidate,
        primaryLocator: selectedSuggestion.primaryLocator,
        heuristicScore: selectedSuggestion.heuristicScore,
        modelScore: selectedSuggestion.ml && selectedSuggestion.ml.score ? selectedSuggestion.ml.score : 0,
        hybridScore: selectedSuggestion.hybrid && selectedSuggestion.hybrid.score ? selectedSuggestion.hybrid.score : 0,
        confidence: selectedSuggestion.confidence,
        healDecision: selectedSuggestion.healDecision,
        notes
    }, {
        historyPath
    });

    const trainingResult = autoTrain
        ? trainAndPersistLocatorRepairModel({
            mode: 'hybrid',
            modelPath,
            historyPath
        })
        : null;

    return {
        entry,
        history: getLocatorRepairHistory({ historyPath, limit: 8 }),
        model: trainingResult
            ? trainingResult.model
            : getRuntimeModelState({ modelPath }).summary
    };
}

module.exports = {
    DEFAULT_ENGINE_MODE,
    DEFAULT_SAMPLE_ID,
    buildBootstrapTrainingExamples,
    buildCandidateFingerprint,
    buildLocatorRepairModuleOverview,
    getLocatorRepairHistory,
    getRuntimeModelState,
    getSampleCase,
    getSampleCaseIds,
    recordLocatorRepairFeedback,
    suggestLocatorRepairs,
    trainAndPersistLocatorRepairModel
};
