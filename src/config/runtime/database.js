const { isNonEmptyString, isPlaceholderValue } = require('./helpers');

const LOCAL_MONGO_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal'
]);

function isProtectedRuntimeEnvironment(env = process.env) {
    const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
    return Boolean(nodeEnv) && !['development', 'dev', 'test', 'local'].includes(nodeEnv);
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
    const tlsRequired = isProtectedRuntimeEnvironment(env) || !local;

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
    buildDatabaseConfig,
    hasMongoTlsEnabled,
    isLocalMongoUri,
    isProtectedRuntimeEnvironment,
    parseMongoHosts
};
