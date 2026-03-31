const { handleApiError } = require('../utils/errorHandler');
const locatorRepairResearchService = require('../services/locatorRepairResearchService');
const { resolveUserScopedLocatorRepairPaths } = require('../utils/locatorRepairStorageScope');

function resolveBaseUrl(req) {
    if (req.app && req.app.locals && req.app.locals.appBaseUrl) {
        return req.app.locals.appBaseUrl;
    }

    if (typeof req.get === 'function') {
        const host = req.get('host');
        if (host) {
            return `${req.protocol || 'http'}://${host}`;
        }
    }

    return 'http://localhost:3000';
}

function resolveLocatorRepairPaths(req = {}) {
    return resolveUserScopedLocatorRepairPaths(req.user, {
        rootDir: req.app && req.app.locals ? req.app.locals.locatorRepairStorageRoot : ''
    });
}

exports.getOverview = async (req, res) => {
    try {
        const storagePaths = resolveLocatorRepairPaths(req);
        const overview = locatorRepairResearchService.buildLocatorRepairModuleOverview({
            baseUrl: resolveBaseUrl(req),
            modelPath: storagePaths.modelPath,
            historyPath: storagePaths.historyPath
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get self-healing module overview');
    }
};

exports.suggestRepairs = async (req, res) => {
    try {
        const storagePaths = resolveLocatorRepairPaths(req);
        const locator = typeof req.body?.locator === 'string' ? req.body.locator.trim() : '';
        const stepGoal = typeof req.body?.stepGoal === 'string' ? req.body.stepGoal.trim() : '';
        const htmlSnippet = typeof req.body?.htmlSnippet === 'string' ? req.body.htmlSnippet : '';
        const errors = [];

        if (!locator) {
            errors.push('locator is required');
        }

        if (!htmlSnippet.trim()) {
            errors.push('htmlSnippet is required');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const suggestions = locatorRepairResearchService.suggestLocatorRepairs({
            locator,
            stepGoal,
            htmlSnippet,
            modelPath: storagePaths.modelPath
        });

        return res.status(200).json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        return handleApiError(res, error, 'Suggest self-healing repairs');
    }
};

exports.getHistory = async (req, res) => {
    try {
        const storagePaths = resolveLocatorRepairPaths(req);
        const history = locatorRepairResearchService.getLocatorRepairHistory({
            limit: req.query && req.query.limit ? Number.parseInt(req.query.limit, 10) : 8,
            historyPath: storagePaths.historyPath
        });

        return res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        return handleApiError(res, error, 'Get self-healing history');
    }
};

exports.recordFeedback = async (req, res) => {
    try {
        const storagePaths = resolveLocatorRepairPaths(req);
        const locator = typeof req.body?.locator === 'string' ? req.body.locator.trim() : '';
        const stepGoal = typeof req.body?.stepGoal === 'string' ? req.body.stepGoal.trim() : '';
        const htmlSnippet = typeof req.body?.htmlSnippet === 'string' ? req.body.htmlSnippet : '';
        const feedbackLabel = typeof req.body?.feedbackLabel === 'string' ? req.body.feedbackLabel.trim().toLowerCase() : '';
        const errors = [];

        if (!locator) {
            errors.push('locator is required');
        }

        if (!htmlSnippet.trim()) {
            errors.push('htmlSnippet is required');
        }

        if (!feedbackLabel) {
            errors.push('feedbackLabel is required');
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const feedback = locatorRepairResearchService.recordLocatorRepairFeedback({
            locator,
            stepGoal,
            htmlSnippet,
            selectedFingerprint: typeof req.body?.selectedFingerprint === 'string' ? req.body.selectedFingerprint.trim() : '',
            suggestionRank: req.body?.suggestionRank,
            feedbackLabel,
            verified: Boolean(req.body?.verified),
            framework: typeof req.body?.framework === 'string' ? req.body.framework.trim() : '',
            route: typeof req.body?.route === 'string' ? req.body.route.trim() : '',
            scenarioId: typeof req.body?.scenarioId === 'string' ? req.body.scenarioId.trim() : '',
            notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : '',
            modelPath: storagePaths.modelPath,
            historyPath: storagePaths.historyPath
        });

        return res.status(200).json({
            success: true,
            message: 'Self-healing feedback recorded successfully',
            data: feedback
        });
    } catch (error) {
        return handleApiError(res, error, 'Record self-healing feedback');
    }
};

exports.trainModel = async (req, res) => {
    try {
        const storagePaths = resolveLocatorRepairPaths(req);
        const mode = typeof req.body?.mode === 'string'
            ? req.body.mode.trim().toLowerCase()
            : 'hybrid';

        if (!['bootstrap', 'hybrid'].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['mode must be either bootstrap or hybrid']
            });
        }

        const result = locatorRepairResearchService.trainAndPersistLocatorRepairModel({
            mode,
            modelPath: storagePaths.modelPath,
            historyPath: storagePaths.historyPath
        });

        return res.status(200).json({
            success: true,
            message: mode === 'bootstrap'
                ? 'Bootstrap self-healing model trained successfully'
                : 'Hybrid self-healing model trained successfully',
            data: result
        });
    } catch (error) {
        return handleApiError(res, error, 'Train self-healing model');
    }
};
