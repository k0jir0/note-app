const { expect } = require('chai');
const sinon = require('sinon');

const {
    connectDatabase,
    listenAsync,
    startApplication
} = require('../src/utils/appStartup');

describe('app startup utilities', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('connects to MongoDB before the app starts listening', async () => {
        const callOrder = [];
        const logger = { log: sandbox.spy() };
        const fakeServer = {
            once: sandbox.stub(),
            off: sandbox.stub()
        };
        const mongooseLib = {
            connect: sandbox.stub().callsFake(async () => {
                callOrder.push('connect');
            })
        };
        const app = {
            listen: sandbox.stub().callsFake((port, callback) => {
                callOrder.push('listen');
                setImmediate(callback);
                return fakeServer;
            })
        };

        const server = await startApplication({
            app,
            mongooseLib,
            dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
            port: 3000,
            logger
        });

        expect(server).to.equal(fakeServer);
        expect(callOrder).to.deep.equal(['connect', 'listen']);
        sinon.assert.calledOnceWithExactly(mongooseLib.connect, 'mongodb://127.0.0.1:27017/noteAppTest');
        sinon.assert.calledOnce(app.listen);
        expect(app.listen.firstCall.args[0]).to.equal(3000);
        expect(app.listen.firstCall.args[1]).to.be.a('function');
        expect(logger.log.firstCall.args[0]).to.equal('MongoDB connected successfully');
        expect(logger.log.secondCall.args[0]).to.equal('Server running on port 3000');
    });

    it('does not start listening when the MongoDB connection fails', async () => {
        const connectError = new Error('timed out');
        const logger = { log: sandbox.spy() };
        const mongooseLib = {
            connect: sandbox.stub().rejects(connectError)
        };
        const app = {
            listen: sandbox.stub()
        };

        let caughtError = null;

        try {
            await startApplication({
                app,
                mongooseLib,
                dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
                port: 3000,
                logger
            });
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).to.be.instanceOf(Error);
        expect(caughtError.message).to.equal('MongoDB connection error: timed out');
        sinon.assert.notCalled(app.listen);
        sinon.assert.notCalled(logger.log);
    });

    it('surfaces listen errors to the caller', async () => {
        const listenError = new Error('port in use');
        const logger = { log: sandbox.spy() };
        const fakeServer = {
            once: sandbox.stub().callsFake((event, handler) => {
                if (event === 'error') {
                    setImmediate(() => handler(listenError));
                }
            }),
            off: sandbox.stub()
        };
        const mongooseLib = {
            connect: sandbox.stub().resolves()
        };
        const app = {
            listen: sandbox.stub().callsFake(() => fakeServer)
        };

        let caughtError = null;

        try {
            await startApplication({
                app,
                mongooseLib,
                dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
                port: 3000,
                logger
            });
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).to.equal(listenError);
        sinon.assert.calledOnce(mongooseLib.connect);
        sinon.assert.calledOnce(app.listen);
    });

    it('exposes the lower-level helpers for direct reuse', async () => {
        const logger = { log: sandbox.spy() };
        const mongooseLib = {
            connect: sandbox.stub().resolves()
        };
        const fakeServer = {
            once: sandbox.stub(),
            off: sandbox.stub()
        };
        const app = {
            listen: sandbox.stub().callsFake((port, callback) => {
                setImmediate(callback);
                return fakeServer;
            })
        };

        await connectDatabase({
            mongooseLib,
            dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
            logger
        });
        const server = await listenAsync({
            app,
            port: 3001
        });

        expect(server).to.equal(fakeServer);
        sinon.assert.calledOnceWithExactly(logger.log, 'MongoDB connected successfully');
        sinon.assert.calledOnce(app.listen);
        expect(app.listen.firstCall.args[0]).to.equal(3001);
        expect(app.listen.firstCall.args[1]).to.be.a('function');
    });

    it('supports starting the app through an injected server factory', async () => {
        const fakeTlsServer = {
            once: sandbox.stub(),
            off: sandbox.stub(),
            listen: sandbox.stub().callsFake((port, callback) => {
                setImmediate(callback);
                return fakeTlsServer;
            })
        };
        const serverFactory = sandbox.stub().returns(fakeTlsServer);
        const mongooseLib = {
            connect: sandbox.stub().resolves()
        };
        const app = {
            listen: sandbox.stub()
        };

        const server = await startApplication({
            app,
            mongooseLib,
            dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
            port: 3443,
            logger: { log: sandbox.spy() },
            serverFactory
        });

        expect(server).to.equal(fakeTlsServer);
        sinon.assert.calledOnceWithExactly(serverFactory, app);
        sinon.assert.calledOnce(fakeTlsServer.listen);
        expect(fakeTlsServer.listen.firstCall.args[0]).to.equal(3443);
        sinon.assert.notCalled(app.listen);
    });

    it('treats a null serverFactory as a normal HTTP app.listen startup', async () => {
        const logger = { log: sandbox.spy() };
        const fakeServer = {
            once: sandbox.stub(),
            off: sandbox.stub()
        };
        const mongooseLib = {
            connect: sandbox.stub().resolves()
        };
        const app = {
            listen: sandbox.stub().callsFake((port, callback) => {
                setImmediate(callback);
                return fakeServer;
            })
        };

        const server = await startApplication({
            app,
            mongooseLib,
            dbURI: 'mongodb://127.0.0.1:27017/noteAppTest',
            port: 3000,
            logger,
            serverFactory: null
        });

        expect(server).to.equal(fakeServer);
        sinon.assert.calledOnce(app.listen);
        sinon.assert.calledOnce(mongooseLib.connect);
    });
});
