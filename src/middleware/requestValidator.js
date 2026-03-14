const { validateNoteData } = require('../utils/validation');

function validateCreateNote(req, res, next) {
    const data = req.body || {};
    const validation = validateNoteData(data, false);
    if (!validation.isValid) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: validation.errors });
    }
    return next();
}

function validateUpdateNote(req, res, next) {
    const data = req.body || {};
    const validation = validateNoteData(data, true);
    if (!validation.isValid) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: validation.errors });
    }
    return next();
}

module.exports = {
    validateCreateNote,
    validateUpdateNote
};
