/**
 * Pagination utility for database queries
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Parse and validate pagination parameters from request
 * @param {Object} query - Express request.query object
 * @returns {Object} { page, limit, skip }
 */
const parsePaginationParams = (query = {}) => {
    const parsedPage = Number.parseInt(query.page, 10);
    const parsedLimit = Number.parseInt(query.limit, 10);

    let page = Number.isNaN(parsedPage) ? DEFAULT_PAGE : parsedPage;
    let limit = Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit;

    // Validate and sanitize
    if (page < 1) page = DEFAULT_PAGE;
    if (limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

/**
 * Create pagination metadata for API responses
 * @param {number} totalCount - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const createPaginationMeta = (totalCount, page, limit) => {
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
        currentPage: page,
        totalPages,
        totalCount,
        itemsPerPage: limit,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null
    };
};

module.exports = {
    parsePaginationParams,
    createPaginationMeta,
    DEFAULT_PAGE,
    DEFAULT_LIMIT,
    MAX_LIMIT
};
