const rateLimit = require('express-rate-limit');

const buildRateLimitMessage = (message) => ({
    success: false,
    message
});

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: buildRateLimitMessage('Too many authentication attempts. Please try again later.')
});

const destructiveActionRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: buildRateLimitMessage('Too many destructive requests. Please wait before trying again.')
});

module.exports = {
    authRateLimiter,
    destructiveActionRateLimiter
};
