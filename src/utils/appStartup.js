function formatErrorMessage(prefix, error) {
    const detail = error && error.message ? error.message : String(error);
    return `${prefix}: ${detail}`;
}

function removeErrorListener(server, handler) {
    if (!server || typeof handler !== 'function') {
        return;
    }

    if (typeof server.off === 'function') {
        server.off('error', handler);
        return;
    }

    if (typeof server.removeListener === 'function') {
        server.removeListener('error', handler);
    }
}

async function connectDatabase({ mongooseLib, dbURI, logger = console } = {}) {
    if (!mongooseLib || typeof mongooseLib.connect !== 'function') {
        throw new TypeError('A valid mongoose instance is required to connect the database.');
    }

    try {
        await mongooseLib.connect(dbURI);
    } catch (error) {
        throw new Error(formatErrorMessage('MongoDB connection error', error));
    }

    if (logger && typeof logger.log === 'function') {
        logger.log('MongoDB connected successfully');
    }
}

async function listenAsync({ app, port, serverFactory } = {}) {
    if (!app || typeof app.listen !== 'function') {
        throw new TypeError('A valid Express app is required to start the server.');
    }

    if (serverFactory !== undefined && typeof serverFactory !== 'function') {
        throw new TypeError('serverFactory must be a function when provided.');
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let server;

        const onError = (error) => {
            if (settled) {
                return;
            }

            settled = true;
            reject(error);
        };

        try {
            if (serverFactory) {
                server = serverFactory(app);

                if (!server || typeof server.listen !== 'function') {
                    throw new TypeError('serverFactory must return a server with a listen method.');
                }

                if (typeof server.once === 'function') {
                    server.once('error', onError);
                }

                server.listen(port, () => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    removeErrorListener(server, onError);
                    resolve(server);
                });
            } else {
                server = app.listen(port, () => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    removeErrorListener(server, onError);
                    resolve(server);
                });

                if (server && typeof server.once === 'function') {
                    server.once('error', onError);
                }
            }
        } catch (error) {
            if (!settled) {
                settled = true;
                reject(error);
            }
        }
    });
}

async function startApplication({ app, mongooseLib, dbURI, port, logger = console, serverFactory } = {}) {
    await connectDatabase({
        mongooseLib,
        dbURI,
        logger
    });

    const server = await listenAsync({
        app,
        port,
        serverFactory
    });

    if (logger && typeof logger.log === 'function') {
        logger.log(`Server running on port ${port}`);
    }

    return server;
}

module.exports = {
    connectDatabase,
    listenAsync,
    startApplication
};
