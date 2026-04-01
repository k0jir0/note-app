const {
    buildCurrentSessionState,
    getLoginReasonMessage,
    recordSessionLock,
    refreshAuthenticatedSession
} = require('../services/sessionManagementService');

function isApiRequest(req = {}) {
    return String(req.path || '').startsWith('/api/')
        || (typeof req.get === 'function' && String(req.get('accept') || '').includes('application/json'));
}

function logoutRequest(req) {
    if (!req || typeof req.logout !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        req.logout((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function destroySession(req) {
    if (!req || !req.session || typeof req.session.destroy !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        req.session.destroy((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function lockDownSession(req, res, lockReason, runtimeConfig) {
    const lockState = await recordSessionLock({
        user: req.user,
        session: req.session,
        reason: lockReason,
        runtimeConfig
    });

    await logoutRequest(req).catch(() => {});
    await destroySession(req).catch(() => {});

    if (res && typeof res.clearCookie === 'function') {
        res.clearCookie('connect.sid');
    }

    return lockState;
}

async function enforceStrictSessionManagement(req, res, next) {
    try {
        const runtimeConfig = req.app && req.app.locals ? req.app.locals.runtimeConfig : {};

        if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
            res.locals.sessionManagement = buildCurrentSessionState({
                user: null,
                session: req.session,
                runtimeConfig
            });
            return next();
        }

        const currentState = await refreshAuthenticatedSession({
            user: req.user,
            session: req.session,
            runtimeConfig
        });

        res.locals.sessionManagement = currentState;

        if (currentState.valid) {
            return next();
        }

        const lockState = await lockDownSession(req, res, currentState.lockReason, runtimeConfig);
        const reasonMessage = getLoginReasonMessage(currentState.lockReason);

        if (isApiRequest(req)) {
            return res.status(401).json({
                success: false,
                message: 'Session locked - Please sign in again',
                errors: [reasonMessage || lockState.lockReasonDescription],
                data: {
                    reason: currentState.lockReason,
                    session: {
                        networkZone: currentState.networkZone,
                        fieldDeployed: currentState.fieldDeployed
                    }
                }
            });
        }

        const reasonQuery = currentState.lockReason ? `?reason=${encodeURIComponent(currentState.lockReason)}` : '';
        return res.redirect(`/auth/login${reasonQuery}`);
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    enforceStrictSessionManagement
};
