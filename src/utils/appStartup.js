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

async function listenAsync({ app, port } = {}) {
    if (!app || typeof app.listen !== 'function') {
        throw new TypeError('A valid Express app is required to start the server.');
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
    });
}

async function startApplication({ app, mongooseLib, dbURI, port, logger = console } = {}) {
    await connectDatabase({
        mongooseLib,
        dbURI,
        logger
    });

    const server = await listenAsync({
        app,
        port
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
