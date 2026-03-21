const { validateNoteData, sanitizeNoteData } = require('./validation');

const ALLOWED_NOTE_FIELDS = ['title', 'content', 'image'];
const IGNORED_NOTE_FIELDS = ['_csrf'];

function stripIgnoredFields(payload = {}) {
    return Object.fromEntries(
        Object.entries(payload).filter(([field]) => !IGNORED_NOTE_FIELDS.includes(field))
    );
}

function getDisallowedFields(payload = {}) {
    return Object.keys(payload).filter((field) => !ALLOWED_NOTE_FIELDS.includes(field));
}

function mapValidationErrorsToFields(errors = []) {
    const fieldErrors = {};

    errors.forEach((message) => {
        if (/title/i.test(message)) {
            fieldErrors.title = fieldErrors.title || message;
            return;
        }

        if (/content/i.test(message)) {
            fieldErrors.content = fieldErrors.content || message;
            return;
        }

        if (/image/i.test(message)) {
            fieldErrors.image = fieldErrors.image || message;
        }
    });

    return fieldErrors;
}

function buildInvalidResult(message, errors, inputData = {}, sanitizedData = {}) {
    return {
        isValid: false,
        message,
        errors,
        inputData,
        sanitizedData,
        fieldErrors: mapValidationErrorsToFields(errors)
    };
}

function validateNotePayload(payload, { isUpdate = false } = {}) {
    const inputData = stripIgnoredFields(payload || {});

    if (Object.keys(inputData).length === 0) {
        return buildInvalidResult(
            'Request body cannot be empty',
            [isUpdate ? 'Please provide data to update' : 'Please provide note data'],
            inputData
        );
    }

    const disallowedFields = getDisallowedFields(inputData);
    if (disallowedFields.length > 0) {
        return buildInvalidResult(
            'Validation failed',
            [`Unexpected field(s): ${disallowedFields.join(', ')}`],
            inputData
        );
    }

    const sanitizedData = sanitizeNoteData(inputData);
    const validation = validateNoteData(sanitizedData, isUpdate);
    if (!validation.isValid) {
        return buildInvalidResult('Validation failed', validation.errors, inputData, sanitizedData);
    }

    return {
        isValid: true,
        inputData,
        sanitizedData,
        fieldErrors: {}
    };
}

function buildCreateNoteData(payload, userId) {
    const validation = validateNotePayload(payload, { isUpdate: false });
    if (!validation.isValid) {
        return validation;
    }

    return {
        ...validation,
        data: {
            title: validation.sanitizedData.title,
            content: validation.sanitizedData.content || '',
            image: validation.sanitizedData.image || '',
            user: userId
        }
    };
}

function buildUpdateNoteData(payload) {
    const validation = validateNotePayload(payload, { isUpdate: true });
    if (!validation.isValid) {
        return validation;
    }

    const updateData = {};
    if (validation.sanitizedData.title !== undefined) updateData.title = validation.sanitizedData.title;
    if (validation.sanitizedData.content !== undefined) updateData.content = validation.sanitizedData.content;
    if (validation.sanitizedData.image !== undefined) updateData.image = validation.sanitizedData.image;

    if (Object.keys(updateData).length === 0) {
        return buildInvalidResult(
            'Validation failed',
            ['Please provide at least one valid field to update'],
            validation.inputData,
            validation.sanitizedData
        );
    }

    return {
        ...validation,
        data: updateData
    };
}

module.exports = {
    ALLOWED_NOTE_FIELDS,
    buildCreateNoteData,
    buildUpdateNoteData,
    getDisallowedFields,
    mapValidationErrorsToFields,
    stripIgnoredFields
};
