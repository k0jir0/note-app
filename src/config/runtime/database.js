const { isNonEmptyString, isPlaceholderValue } = require('./helpers');

const LOCAL_MONGO_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal'
]);
const LOCAL_APP_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal'
]);
const LOCAL_RUNTIME_PROFILES = new Set(['development', 'dev', 'test', 'local']);
const PROTECTED_RUNTIME_PROFILES = new Set(['production', 'prod', 'staging', 'stage', 'qa', 'uat', 'preprod', 'preproduction', 'protected']);

function normalizeRuntimeProfile(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
        return '';
    }

    if (LOCAL_RUNTIME_PROFILES.has(normalized)) {
        return normalized === 'test' ? 'test' : 'local';
    }

    if (PROTECTED_RUNTIME_PROFILES.has(normalized)) {
        return 'protected';
    }

    return '';
}

function parseAppBaseUrl(value = '') {
    if (!isNonEmptyString(value)) {
        return {
            configured: false,
            protocol: '',
            hostname: ''
        };
    }

    try {
        const parsed = new URL(value.trim());
        return {
            configured: true,
            protocol: String(parsed.protocol || '').trim().toLowerCase(),
            hostname: String(parsed.hostname || '').trim().toLowerCase()
        };
    } catch (_error) {
        return {
            configured: true,
            protocol: '',
            hostname: ''
        };
    }
}

function parseMongoHosts(uri = '') {
    const trimmedUri = String(uri || '').trim();
    const withoutScheme = trimmedUri.replace(/^mongodb(?:\+srv)?:\/\//i, '');
    const hostSegment = withoutScheme.split('/')[0].split('@').pop() || '';

    return hostSegment
        .split(',')
        .map((host) => host.split(':')[0].trim().toLowerCase())
        .filter(Boolean);
}

function isLocalMongoHost(host = '') {
    return LOCAL_MONGO_HOSTS.has(host);
}

function isLocalMongoUri(uri = '') {
    const hosts = parseMongoHosts(uri);
    return hosts.length > 0 && hosts.every((host) => isLocalMongoHost(host));
}

function isLocalAppBaseUrl(value = '') {
    const parsed = parseAppBaseUrl(value);
    if (!parsed.configured) {
        return true;
    }

    if (!LOCAL_APP_HOSTS.has(parsed.hostname)) {
        return false;
    }

    return !parsed.protocol || parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function inferRuntimeProfile(env = process.env) {
    const explicitProfile = normalizeRuntimeProfile(env.RUNTIME_POSTURE);
    if (explicitProfile) {
        return {
            profile: explicitProfile,
            protectedRuntime: explicitProfile === 'protected',
            source: 'runtime_posture'
        };
    }

    const nodeEnvProfile = normalizeRuntimeProfile(env.NODE_ENV);
    if (nodeEnvProfile) {
        return {
            profile: nodeEnvProfile,
            protectedRuntime: nodeEnvProfile === 'protected',
            source: 'node_env'
        };
    }

    const appBaseUrlConfigured = isNonEmptyString(env.APP_BASE_URL);
    const appBaseUrlLocal = isLocalAppBaseUrl(env.APP_BASE_URL);
    const mongoUriConfigured = isNonEmptyString(env.MONGODB_URI);
    const mongoLocal = !mongoUriConfigured || isLocalMongoUri(env.MONGODB_URI);
    const trustProxyHops = Number.parseInt(String(env.TRUST_PROXY_HOPS || '').trim(), 10);
    const trustProxyConfigured = Number.isInteger(trustProxyHops) && trustProxyHops > 0;
    const nonLocalPublicOriginConfigured = appBaseUrlConfigured && !appBaseUrlLocal;
    const protectedRuntime = !mongoLocal
        || nonLocalPublicOriginConfigured
        || (trustProxyConfigured && nonLocalPublicOriginConfigured);

    return {
        profile: protectedRuntime ? 'protected' : 'local',
        protectedRuntime,
        source: protectedRuntime ? 'heuristic_protected' : 'heuristic_local'
    };
}

function buildRuntimePosture(env = process.env, errors = []) {
    const explicitProfile = String(env.RUNTIME_POSTURE || '').trim();
    const normalizedExplicitProfile = normalizeRuntimeProfile(explicitProfile);
    if (explicitProfile && !normalizedExplicitProfile) {
        errors.push('RUNTIME_POSTURE must be one of local, test, or protected when set');
    }

    const nodeEnv = String(env.NODE_ENV || '').trim();
    const normalizedNodeEnvProfile = normalizeRuntimeProfile(nodeEnv);
    if (explicitProfile && normalizedExplicitProfile && nodeEnv && normalizedNodeEnvProfile && normalizedExplicitProfile !== normalizedNodeEnvProfile) {
        errors.push('RUNTIME_POSTURE conflicts with NODE_ENV. Align them to the same security posture.');
    }

    return inferRuntimeProfile(env);
}

function isProtectedRuntimeEnvironment(env = process.env) {
    return buildRuntimePosture(env).protectedRuntime;
}

function hasMongoTlsEnabled(uri = '') {
    const trimmedUri = String(uri || '').trim();
    if (/^mongodb\+srv:\/\//i.test(trimmedUri)) {
        return true;
    }

    const queryString = trimmedUri.split('?')[1] || '';
    const queryParams = new URLSearchParams(queryString);
    const tlsValue = String(queryParams.get('tls') || queryParams.get('ssl') || '').trim().toLowerCase();

    return tlsValue === 'true' || tlsValue === '1';
}

function buildDatabaseConfig(env = process.env, errors = []) {
    if (!isNonEmptyString(env.MONGODB_URI)) {
        errors.push('MONGODB_URI is required');
        return {
            uri: '',
            tlsRequired: false,
            tlsEnabled: false,
            local: false
        };
    }

    if (isPlaceholderValue('MONGODB_URI', env.MONGODB_URI)) {
        errors.push('MONGODB_URI must be set to a real connection string');
    }

    const uri = env.MONGODB_URI.trim();
    const local = isLocalMongoUri(uri);
    const tlsEnabled = hasMongoTlsEnabled(uri);
    const tlsRequired = buildRuntimePosture(env).protectedRuntime || !local;

    if (tlsRequired && !tlsEnabled) {
        errors.push('MONGODB_URI must enable TLS via mongodb+srv:// or ?tls=true for non-local or protected runtime deployments');
    }

    return {
        uri,
        tlsRequired,
        tlsEnabled,
        local
    };
}

module.exports = {
    buildRuntimePosture,
    buildDatabaseConfig,
    hasMongoTlsEnabled,
    inferRuntimeProfile,
    isLocalAppBaseUrl,
    isLocalMongoUri,
    isProtectedRuntimeEnvironment,
    normalizeRuntimeProfile,
    parseMongoHosts
};
