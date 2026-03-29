const { stripSensitiveResponseHeaders } = require('../utils/metadataSanitization');

function sanitizeResponseMetadata(req, res, next) {
    stripSensitiveResponseHeaders(res);

    if (res.locals) {
        res.locals.serverSignature = '';
    }

    if (!res.__metadataProtectionApplied) {
        const originalWriteHead = res.writeHead;
        res.writeHead = function writeHeadProxy(...args) {
            stripSensitiveResponseHeaders(this);
            return originalWriteHead.apply(this, args);
        };
        res.__metadataProtectionApplied = true;
    }

    return next();
}

module.exports = {
    sanitizeResponseMetadata
};