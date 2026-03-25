const ScanResult = require('../models/ScanResult');
const { handleApiError } = require('../utils/errorHandler');
const { persistScanImport } = require('../services/securityIngestService');

const SCAN_LIST_SELECT = 'target tool findings summary importedAt';

const parseLimit = (value, fallback = 20, max = 100) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

exports.importScan = async (req, res) => {
    try {
        const rawInput = typeof req.body.rawInput === 'string' ? req.body.rawInput : '';

        if (!rawInput.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['rawInput is required']
            });
        }

        const result = await persistScanImport({
            userId: req.user._id,
            source: 'manual-scan-input',
            rawInput
        });

        return res.status(200).json({
            success: true,
            message: 'Scan imported successfully',
            data: {
                linesAnalyzed: result.linesAnalyzed,
                truncated: result.truncated,
                inputLimit: result.inputLimit,
                findingsCount: result.findingsCount,
                scan: result.scan
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Import scan');
    }
};

exports.getScans = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 100);

        const [scans, totalCount] = await Promise.all([
            ScanResult.find({ user: req.user._id })
                .select(SCAN_LIST_SELECT)
                .sort({ importedAt: -1, createdAt: -1 })
                .lean()
                .limit(limit),
            ScanResult.countDocuments({ user: req.user._id })
        ]);

        return res.status(200).json({
            success: true,
            count: scans.length,
            totalCount,
            data: scans
        });
    } catch (error) {
        return handleApiError(res, error, 'Get scans');
    }
};
