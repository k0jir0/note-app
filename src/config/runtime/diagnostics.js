const { DEFAULT_CIPHER_ALGO, isNonEmptyString } = require('./helpers');
const { buildAutomationDiagnostics } = require('./automation');

function toDiagnosticRuntimeConfig(runtimeConfig) {
    if (!runtimeConfig || typeof runtimeConfig !== 'object') {
        return null;
    }

    const automation = runtimeConfig.automation || {};

    return {
        runtimePosture: {
            profile: runtimeConfig.runtimePosture && runtimeConfig.runtimePosture.profile
                ? String(runtimeConfig.runtimePosture.profile)
                : 'local',
            protectedRuntime: Boolean(runtimeConfig.runtimePosture && runtimeConfig.runtimePosture.protectedRuntime),
            source: runtimeConfig.runtimePosture && runtimeConfig.runtimePosture.source
                ? String(runtimeConfig.runtimePosture.source)
                : ''
        },
        dbConfigured: isNonEmptyString(runtimeConfig.dbURI),
        database: {
            tlsRequired: Boolean(runtimeConfig.database && runtimeConfig.database.tlsRequired),
            tlsEnabled: Boolean(runtimeConfig.database && runtimeConfig.database.tlsEnabled),
            local: Boolean(runtimeConfig.database && runtimeConfig.database.local)
        },
        sessionSecretConfigured: isNonEmptyString(runtimeConfig.sessionSecret),
        noteEncryptionConfigured: isNonEmptyString(runtimeConfig.noteEncryptionKey),
        cipherAlgo: isNonEmptyString(runtimeConfig.cipherAlgo) ? runtimeConfig.cipherAlgo.trim() : DEFAULT_CIPHER_ALGO,
        appBaseUrl: isNonEmptyString(runtimeConfig.appBaseUrl) ? runtimeConfig.appBaseUrl.trim() : '',
        googleAuthEnabled: Boolean(runtimeConfig.googleAuthEnabled),
        sessionManagement: {
            idleTimeoutMinutes: Number.isFinite(runtimeConfig.sessionManagement && runtimeConfig.sessionManagement.idleTimeoutMinutes)
                ? runtimeConfig.sessionManagement.idleTimeoutMinutes
                : null,
            absoluteTimeoutHours: Number.isFinite(runtimeConfig.sessionManagement && runtimeConfig.sessionManagement.absoluteTimeoutHours)
                ? runtimeConfig.sessionManagement.absoluteTimeoutHours
                : null,
            missionIdleTimeoutMinutes: Number.isFinite(runtimeConfig.sessionManagement && runtimeConfig.sessionManagement.missionIdleTimeoutMinutes)
                ? runtimeConfig.sessionManagement.missionIdleTimeoutMinutes
                : null,
            missionAbsoluteTimeoutHours: Number.isFinite(runtimeConfig.sessionManagement && runtimeConfig.sessionManagement.missionAbsoluteTimeoutHours)
                ? runtimeConfig.sessionManagement.missionAbsoluteTimeoutHours
                : null,
            preventConcurrentLogins: Boolean(runtimeConfig.sessionManagement && runtimeConfig.sessionManagement.preventConcurrentLogins)
        },
        transport: {
            protocol: runtimeConfig.transport && runtimeConfig.transport.protocol
                ? String(runtimeConfig.transport.protocol)
                : ((runtimeConfig.transport && (
                    runtimeConfig.transport.httpsEnabled
                    || runtimeConfig.transport.proxyTlsTerminated
                ))
                    ? 'https'
                    : 'http'),
            httpsEnabled: Boolean(runtimeConfig.transport && runtimeConfig.transport.httpsEnabled),
            requestClientCertificate: Boolean(runtimeConfig.transport && runtimeConfig.transport.requestClientCertificate),
            requireClientCertificate: Boolean(runtimeConfig.transport && runtimeConfig.transport.requireClientCertificate),
            trustProxyClientCertHeaders: Boolean(runtimeConfig.transport && runtimeConfig.transport.trustProxyClientCertHeaders),
            trustProxyHops: Number.isInteger(runtimeConfig.transport && runtimeConfig.transport.trustProxyHops)
                ? runtimeConfig.transport.trustProxyHops
                : 0,
            secureTransportRequired: Boolean(runtimeConfig.transport && runtimeConfig.transport.secureTransportRequired),
            proxyTlsTerminated: Boolean(runtimeConfig.transport && runtimeConfig.transport.proxyTlsTerminated),
            tlsMinVersion: runtimeConfig.transport && runtimeConfig.transport.httpsEnabled
                ? String(runtimeConfig.transport.tlsMinVersion || 'TLSv1.3')
                : '',
            tlsMaxVersion: runtimeConfig.transport && runtimeConfig.transport.httpsEnabled
                ? String(runtimeConfig.transport.tlsMaxVersion || 'TLSv1.3')
                : ''
        },
        immutableLogging: {
            enabled: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.enabled),
            required: Boolean(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.required),
            endpointConfigured: isNonEmptyString(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.endpoint),
            timeoutMs: Number.isFinite(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.timeoutMs)
                ? runtimeConfig.immutableLogging.timeoutMs
                : null,
            format: isNonEmptyString(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.format)
                ? runtimeConfig.immutableLogging.format.trim()
                : 'json',
            source: isNonEmptyString(runtimeConfig.immutableLogging && runtimeConfig.immutableLogging.source)
                ? runtimeConfig.immutableLogging.source.trim()
                : ''
        },
        breakGlass: {
            mode: isNonEmptyString(runtimeConfig.breakGlass && runtimeConfig.breakGlass.mode)
                ? runtimeConfig.breakGlass.mode.trim()
                : 'disabled',
            enabled: isNonEmptyString(runtimeConfig.breakGlass && runtimeConfig.breakGlass.mode)
                ? runtimeConfig.breakGlass.mode.trim() !== 'disabled'
                : false,
            reasonConfigured: isNonEmptyString(runtimeConfig.breakGlass && runtimeConfig.breakGlass.reason)
        },
        automation: {
            logBatch: buildAutomationDiagnostics(automation.logBatch),
            scanBatch: buildAutomationDiagnostics(automation.scanBatch),
            intrusionBatch: buildAutomationDiagnostics(automation.intrusionBatch)
        }
    };
}

module.exports = {
    toDiagnosticRuntimeConfig
};
