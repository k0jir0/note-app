const { handleApiError } = require('../utils/errorHandler');
const trainingService = require('../services/alertTriageTrainingService');

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

exports.getOverview = async (req, res) => {
    try {
        const overview = await trainingService.buildAlertTriageModuleOverview({
            userId: req.user._id
        });

        return res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        return handleApiError(res, error, 'Get ML module overview');
    }
};

exports.trainModel = async (req, res) => {
    try {
        const mode = typeof req.body?.mode === 'string'
            ? req.body.mode.trim().toLowerCase()
            : 'mixed';

        if (!['bootstrap', 'mixed'].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['mode must be either bootstrap or mixed']
            });
        }

        const result = await trainingService.trainAndPersistAlertTriageModel({
            mode,
            syntheticCount: parsePositiveInteger(req.body?.syntheticCount, mode === 'bootstrap' ? 1000 : 600),
            minRealCount: parsePositiveInteger(req.body?.minRealCount, 150)
        });

        return res.status(200).json({
            success: true,
            message: mode === 'bootstrap'
                ? 'Bootstrap ML model trained successfully'
                : 'Hybrid ML model trained successfully',
            data: result
        });
    } catch (error) {
        return handleApiError(res, error, 'Train ML model');
    }
};
