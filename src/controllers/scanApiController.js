const ScanResult = require('../models/ScanResult');
const { parseScanInput, MAX_SCAN_INPUT_LENGTH } = require('../utils/scanParser');
const { handleApiError } = require('../utils/errorHandler');

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

        const parsed = parseScanInput(rawInput);
        const highCount = parsed.findings.filter((f) => f.severity === 'high').length;
        const medCount = parsed.findings.filter((f) => f.severity === 'medium').length;
        const summary = `${parsed.tool.toUpperCase()} scan of ${parsed.target}: ` +
            `${parsed.findings.length} finding(s), ${highCount} high, ${medCount} medium`;

        const scan = await ScanResult.create({
            target: parsed.target,
            tool: parsed.tool,
            findings: parsed.findings,
            summary,
            importedAt: new Date(),
            user: req.user._id
        });

        return res.status(200).json({
            success: true,
            message: 'Scan imported successfully',
            data: {
                linesAnalyzed: parsed.linesAnalyzed,
                truncated: parsed.truncated,
                inputLimit: MAX_SCAN_INPUT_LENGTH,
                findingsCount: parsed.findings.length,
                scan
            }
        });
    } catch (error) {
        return handleApiError(res, error, 'Import scan');
    }
};

exports.getScans = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 100);

        const scans = await ScanResult.find({ user: req.user._id })
            .sort({ importedAt: -1, createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            success: true,
            count: scans.length,
            data: scans
        });
    } catch (error) {
        return handleApiError(res, error, 'Get scans');
    }
};
