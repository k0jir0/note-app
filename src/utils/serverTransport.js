const fs = require('fs');
const https = require('https');

const TLS_MIN_VERSION = 'TLSv1.3';
const TLS_MAX_VERSION = 'TLSv1.3';

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeTransportConfig(transport = {}) {
    return {
        protocol: transport.httpsEnabled ? 'https' : 'http',
        httpsEnabled: Boolean(transport.httpsEnabled),
        requestClientCertificate: Boolean(transport.requestClientCertificate),
        requireClientCertificate: Boolean(transport.requireClientCertificate),
        trustProxyClientCertHeaders: Boolean(transport.trustProxyClientCertHeaders),
        tlsMinVersion: transport.httpsEnabled ? TLS_MIN_VERSION : '',
        tlsMaxVersion: transport.httpsEnabled ? TLS_MAX_VERSION : '',
        keyPath: isNonEmptyString(transport.keyPath) ? transport.keyPath.trim() : '',
        certPath: isNonEmptyString(transport.certPath) ? transport.certPath.trim() : '',
        caPath: isNonEmptyString(transport.caPath) ? transport.caPath.trim() : ''
    };
}

function readTlsFile(filePath, label, fsLib = fs) {
    try {
        return fsLib.readFileSync(filePath);
    } catch (error) {
        const detail = error && error.message ? error.message : String(error);
        throw new Error(`Unable to read ${label} file at ${filePath}: ${detail}`);
    }
}

function buildHttpsServerOptions({ transport = {}, fsLib = fs } = {}) {
    const normalizedTransport = normalizeTransportConfig(transport);
    if (!normalizedTransport.httpsEnabled) {
        return null;
    }

    const options = {
        key: readTlsFile(normalizedTransport.keyPath, 'HTTPS private key', fsLib),
        cert: readTlsFile(normalizedTransport.certPath, 'HTTPS certificate', fsLib),
        minVersion: normalizedTransport.tlsMinVersion,
        maxVersion: normalizedTransport.tlsMaxVersion,
        requestCert: normalizedTransport.requestClientCertificate,
        rejectUnauthorized: normalizedTransport.requireClientCertificate
    };

    if (normalizedTransport.requestClientCertificate && normalizedTransport.caPath) {
        options.ca = readTlsFile(normalizedTransport.caPath, 'HTTPS certificate authority', fsLib);
    }

    return options;
}

function createServerFactory({ transport = {}, httpsLib = https, fsLib = fs } = {}) {
    const normalizedTransport = normalizeTransportConfig(transport);
    if (!normalizedTransport.httpsEnabled) {
        return null;
    }

    const options = buildHttpsServerOptions({
        transport: normalizedTransport,
        fsLib
    });

    return (app) => httpsLib.createServer(options, app);
}

module.exports = {
    TLS_MIN_VERSION,
    TLS_MAX_VERSION,
    buildHttpsServerOptions,
    createServerFactory,
    normalizeTransportConfig
};
