const { expect } = require('chai');
const sinon = require('sinon');

const {
    buildHttpsServerOptions,
    createServerFactory,
    normalizeTransportConfig
} = require('../src/utils/serverTransport');

describe('server transport utilities', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('normalizes transport configuration into a stable shape', () => {
        expect(normalizeTransportConfig({
            httpsEnabled: true,
            requestClientCertificate: true,
            requireClientCertificate: false,
            trustProxyClientCertHeaders: true,
            keyPath: ' C:\\tls\\server.key ',
            certPath: ' C:\\tls\\server.crt ',
            caPath: ' C:\\tls\\ca.crt '
        })).to.deep.equal({
            protocol: 'https',
            httpsEnabled: true,
            requestClientCertificate: true,
            requireClientCertificate: false,
            trustProxyClientCertHeaders: true,
            keyPath: 'C:\\tls\\server.key',
            certPath: 'C:\\tls\\server.crt',
            caPath: 'C:\\tls\\ca.crt'
        });
    });

    it('builds HTTPS server options with optional client-certificate validation', () => {
        const fsLib = {
            readFileSync: sandbox.stub()
        };
        fsLib.readFileSync
            .withArgs('C:\\tls\\server.key').returns(Buffer.from('key-data'))
            .withArgs('C:\\tls\\server.crt').returns(Buffer.from('cert-data'))
            .withArgs('C:\\tls\\ca.crt').returns(Buffer.from('ca-data'));

        const options = buildHttpsServerOptions({
            transport: {
                httpsEnabled: true,
                requestClientCertificate: true,
                requireClientCertificate: true,
                keyPath: 'C:\\tls\\server.key',
                certPath: 'C:\\tls\\server.crt',
                caPath: 'C:\\tls\\ca.crt'
            },
            fsLib
        });

        expect(options).to.deep.equal({
            key: Buffer.from('key-data'),
            cert: Buffer.from('cert-data'),
            ca: Buffer.from('ca-data'),
            requestCert: true,
            rejectUnauthorized: true
        });
    });

    it('creates an HTTPS server factory when HTTPS transport is enabled', () => {
        const fsLib = {
            readFileSync: sandbox.stub()
        };
        fsLib.readFileSync
            .withArgs('C:\\tls\\server.key').returns(Buffer.from('key-data'))
            .withArgs('C:\\tls\\server.crt').returns(Buffer.from('cert-data'));

        const fakeServer = { listen: sandbox.stub() };
        const httpsLib = {
            createServer: sandbox.stub().returns(fakeServer)
        };
        const app = { use: sandbox.stub() };

        const serverFactory = createServerFactory({
            transport: {
                httpsEnabled: true,
                keyPath: 'C:\\tls\\server.key',
                certPath: 'C:\\tls\\server.crt'
            },
            httpsLib,
            fsLib
        });

        const server = serverFactory(app);

        expect(server).to.equal(fakeServer);
        sinon.assert.calledOnce(httpsLib.createServer);
        expect(httpsLib.createServer.firstCall.args[0]).to.deep.equal({
            key: Buffer.from('key-data'),
            cert: Buffer.from('cert-data'),
            requestCert: false,
            rejectUnauthorized: false
        });
        expect(httpsLib.createServer.firstCall.args[1]).to.equal(app);
    });

    it('returns null when HTTPS transport is disabled', () => {
        expect(createServerFactory({
            transport: {
                httpsEnabled: false
            }
        })).to.equal(null);
        expect(buildHttpsServerOptions({
            transport: {
                httpsEnabled: false
            }
        })).to.equal(null);
    });
});
