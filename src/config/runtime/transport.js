const {
    isNonEmptyString,
    normalizeAppBaseUrl,
    parseBooleanEnv,
    parseIntegerEnv
} = require('./helpers');
const { buildRuntimePosture } = require('./database');

function buildTransportConfig(env, errors) {
    const httpsEnabled = parseBooleanEnv('HTTPS_ENABLED', env, errors);
    const requestClientCertificate = parseBooleanEnv('HTTPS_REQUEST_CLIENT_CERT', env, errors);
    const requireClientCertificate = parseBooleanEnv('HTTPS_REQUIRE_CLIENT_CERT', env, errors);
    const trustProxyClientCertHeaders = parseBooleanEnv('TRUST_PROXY_CLIENT_CERT_HEADERS', env, errors);
    const trustProxyHops = parseIntegerEnv('TRUST_PROXY_HOPS', env, {
        defaultValue: 0,
        min: 0,
        max: 10
    }, errors);

    const keyPath = isNonEmptyString(env.HTTPS_KEY_PATH) ? env.HTTPS_KEY_PATH.trim() : '';
    const certPath = isNonEmptyString(env.HTTPS_CERT_PATH) ? env.HTTPS_CERT_PATH.trim() : '';
    const caPath = isNonEmptyString(env.HTTPS_CA_PATH) ? env.HTTPS_CA_PATH.trim() : '';
    const protectedRuntime = buildRuntimePosture(env).protectedRuntime;
    const appBaseUrl = normalizeAppBaseUrl(env.APP_BASE_URL);
    const publicOriginHttps = appBaseUrl.startsWith('https://');
    const proxyTlsTerminated = trustProxyHops >= 1 && publicOriginHttps;
    const secureTransportRequired = protectedRuntime;
    const secureTransportConfigured = httpsEnabled || proxyTlsTerminated;

    if (requireClientCertificate && !requestClientCertificate) {
        errors.push('HTTPS_REQUIRE_CLIENT_CERT=true also requires HTTPS_REQUEST_CLIENT_CERT=true');
    }

    if ((requestClientCertificate || requireClientCertificate) && !httpsEnabled) {
        errors.push('HTTPS_REQUEST_CLIENT_CERT and HTTPS_REQUIRE_CLIENT_CERT require HTTPS_ENABLED=true');
    }

    if (trustProxyClientCertHeaders && trustProxyHops < 1) {
        errors.push('TRUST_PROXY_CLIENT_CERT_HEADERS=true requires TRUST_PROXY_HOPS to be at least 1');
    }

    if (httpsEnabled) {
        if (!keyPath) {
            errors.push('HTTPS_KEY_PATH is required when HTTPS_ENABLED=true');
        }

        if (!certPath) {
            errors.push('HTTPS_CERT_PATH is required when HTTPS_ENABLED=true');
        }
    }

    if (requestClientCertificate && !caPath) {
        errors.push('HTTPS_CA_PATH is required when HTTPS_REQUEST_CLIENT_CERT=true');
    }

    if (protectedRuntime && !secureTransportConfigured) {
        errors.push('Protected runtime deployments require HTTPS_ENABLED=true or a trusted TLS-terminating proxy with TRUST_PROXY_HOPS>=1 and APP_BASE_URL=https://...');
    }

    if (protectedRuntime && trustProxyHops >= 1 && !publicOriginHttps) {
        errors.push('APP_BASE_URL must use https:// when TRUST_PROXY_HOPS is configured for protected runtime transport');
    }

    if (protectedRuntime && httpsEnabled && isNonEmptyString(env.APP_BASE_URL) && !publicOriginHttps) {
        errors.push('APP_BASE_URL must use https:// when HTTPS_ENABLED=true in protected runtime environments');
    }

    return {
        protocol: httpsEnabled || proxyTlsTerminated ? 'https' : 'http',
        httpsEnabled,
        requestClientCertificate,
        requireClientCertificate,
        trustProxyClientCertHeaders,
        trustProxyHops,
        tlsMinVersion: httpsEnabled ? 'TLSv1.3' : '',
        tlsMaxVersion: httpsEnabled ? 'TLSv1.3' : '',
        keyPath,
        certPath,
        caPath,
        secureTransportRequired,
        proxyTlsTerminated,
        publicOriginHttps
    };
}

module.exports = {
    buildTransportConfig
};
