const { createPaginationMeta, parsePaginationParams } = require('../utils/pagination');
const { handleApiError } = require('../utils/errorHandler');
const persistentAuditService = require('../services/persistentAuditService');

exports.getEvents = async (req, res) => {
    try {
        const { page, limit } = parsePaginationParams(req.query);
        const level = typeof req.query.level === 'string' ? req.query.level : '';
        const category = typeof req.query.category === 'string' ? req.query.category : '';
        const result = await persistentAuditService.listAuditEventsForUser(req.user._id, {
            page,
            limit,
            level,
            category
        });

        return res.status(200).json({
            success: true,
            count: result.events.length,
            data: result.events,
            filters: {
                level: level || '',
                category: category || ''
            },
            pagination: createPaginationMeta(result.totalCount, result.page, result.limit)
        });
    } catch (error) {
        return handleApiError(res, error, 'Get audit telemetry events');
    }
};
