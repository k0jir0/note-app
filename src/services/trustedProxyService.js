const DEFAULT_LOCAL_TRUSTED_PROXY_ADDRESSES = Object.freeze([
    '127.0.0.1',
    '::1',
    'localhost'
]);

function normalizeSocketAddress(address = '') {
    const trimmed = String(address || '').trim();
    if (!trimmed) {
        return '';
    }

    const withoutPrefix = trimmed.startsWith('::ffff:')
        ? trimmed.slice(7)
        : trimmed;

    if (withoutPrefix.startsWith('[') && withoutPrefix.includes(']')) {
        return withoutPrefix.slice(1, withoutPrefix.indexOf(']'));
    }

    const lastColon = withoutPrefix.lastIndexOf(':');
    if (lastColon > -1 && withoutPrefix.indexOf(':') === lastColon) {
        return withoutPrefix.slice(0, lastColon);
    }

    return withoutPrefix;
}

function normalizeTrustedProxyAddress(address = '') {
    return normalizeSocketAddress(address).toLowerCase();
}

function parseTrustedProxyAddresses(rawValue = '') {
    const values = Array.isArray(rawValue)
        ? rawValue
        : String(rawValue || '').split(',');

    return [...new Set(values
        .map((value) => normalizeTrustedProxyAddress(value))
        .filter(Boolean))];
}

function getTrustedProxyAddressAllowlist(configuredAddresses = []) {
    const parsed = parseTrustedProxyAddresses(configuredAddresses);
    return parsed.length > 0
        ? parsed
        : [...DEFAULT_LOCAL_TRUSTED_PROXY_ADDRESSES];
}

function isTrustedProxyAddress(address = '', configuredAddresses = []) {
    const normalized = normalizeTrustedProxyAddress(address);
    if (!normalized) {
        return false;
    }

    return getTrustedProxyAddressAllowlist(configuredAddresses).includes(normalized);
}

module.exports = {
    DEFAULT_LOCAL_TRUSTED_PROXY_ADDRESSES,
    getTrustedProxyAddressAllowlist,
    isTrustedProxyAddress,
    normalizeSocketAddress,
    parseTrustedProxyAddresses
};
