const {
    encryptText,
    decryptText,
    transformPathValue,
    transformDeepPathValue,
    transformArrayEntries,
    transformUpdatePayload,
    transformBulkWriteOperations
} = require('./fieldEncryption');

function transformUserSensitiveFields(target, stringTransformer) {
    transformPathValue(target, 'name', stringTransformer);
    transformPathValue(target, 'accessProfile.unit', stringTransformer);
    transformDeepPathValue(target, 'accessProfile.assignedMissions', stringTransformer);
    transformDeepPathValue(target, 'accessProfile.networkZones', stringTransformer);
    transformPathValue(target, 'accessProfile.hardwareTokenLabel', stringTransformer);
    transformPathValue(target, 'accessProfile.hardwareTokenSerial', stringTransformer);
    transformArrayEntries(target, 'accessProfile.webauthnCredentials', (credential) => {
        transformPathValue(credential, 'credentialId', stringTransformer);
        transformPathValue(credential, 'publicKey', stringTransformer);
        transformDeepPathValue(credential, 'transports', stringTransformer);
        transformPathValue(credential, 'label', stringTransformer);
    });
    transformPathValue(target, 'accessProfile.pkiCertificateSubject', stringTransformer);
    transformPathValue(target, 'accessProfile.pkiCertificateIssuer', stringTransformer);
    transformPathValue(target, 'accessProfile.breakGlassReason', stringTransformer);
    transformPathValue(target, 'sessionControl.activeSessionId', stringTransformer);
    transformPathValue(target, 'sessionControl.lastLockReason', stringTransformer);
}

function transformLegacyUserEnumFields(target, stringTransformer) {
    transformPathValue(target, 'accessProfile.missionRole', stringTransformer);
    transformPathValue(target, 'accessProfile.clearance', stringTransformer);
    transformPathValue(target, 'accessProfile.deviceTier', stringTransformer);
}

function encryptUserDocument(target) {
    transformUserSensitiveFields(target, encryptText);
    return target;
}

function decryptUserDocument(target) {
    transformUserSensitiveFields(target, decryptText);
    transformLegacyUserEnumFields(target, decryptText);
    return target;
}

function encryptUserUpdatePayload(update) {
    return transformUpdatePayload(update, (payload) => {
        transformUserSensitiveFields(payload, encryptText);
    });
}

function transformSecurityAlertSensitiveFields(target, stringTransformer) {
    transformPathValue(target, 'summary', stringTransformer);
    transformDeepPathValue(target, 'details', stringTransformer, { preserveKeys: ['_fingerprint'] });
    transformDeepPathValue(target, 'mlReasons', stringTransformer);
    transformDeepPathValue(target, 'mlFeatures', stringTransformer);
    transformPathValue(target, 'response.reason', stringTransformer);
    transformPathValue(target, 'response.target', stringTransformer);
    transformArrayEntries(target, 'response.actions', (action) => {
        transformPathValue(action, 'provider', stringTransformer);
        transformPathValue(action, 'detail', stringTransformer);
        transformPathValue(action, 'target', stringTransformer);
    });
}

function encryptSecurityAlertDocument(target) {
    transformSecurityAlertSensitiveFields(target, encryptText);
    return target;
}

function decryptSecurityAlertDocument(target) {
    transformSecurityAlertSensitiveFields(target, decryptText);
    return target;
}

function encryptSecurityAlertUpdatePayload(update) {
    return transformUpdatePayload(update, (payload) => {
        transformSecurityAlertSensitiveFields(payload, encryptText);
    });
}

function encryptSecurityAlertBulkWriteOperations(operations) {
    return transformBulkWriteOperations(operations, encryptSecurityAlertUpdatePayload);
}

function transformScanResultSensitiveFields(target, stringTransformer) {
    transformPathValue(target, 'target', stringTransformer);
    transformPathValue(target, 'summary', stringTransformer);
    transformArrayEntries(target, 'findings', (finding) => {
        transformPathValue(finding, 'title', stringTransformer);
        transformDeepPathValue(finding, 'details', stringTransformer);
    });
}

function encryptScanResultDocument(target) {
    transformScanResultSensitiveFields(target, encryptText);
    return target;
}

function decryptScanResultDocument(target) {
    transformScanResultSensitiveFields(target, decryptText);
    return target;
}

function encryptScanResultUpdatePayload(update) {
    return transformUpdatePayload(update, (payload) => {
        transformScanResultSensitiveFields(payload, encryptText);
    });
}

module.exports = {
    encryptUserDocument,
    decryptUserDocument,
    encryptUserUpdatePayload,
    encryptSecurityAlertDocument,
    decryptSecurityAlertDocument,
    encryptSecurityAlertUpdatePayload,
    encryptSecurityAlertBulkWriteOperations,
    encryptScanResultDocument,
    decryptScanResultDocument,
    encryptScanResultUpdatePayload
};
