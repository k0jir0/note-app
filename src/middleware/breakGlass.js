const {
    BREAK_GLASS_MODES,
    buildBreakGlassState,
    isWriteMethod
} = require('../services/breakGlassService');

const BYPASS_PREFIXES = [
    '/api/runtime/break-glass',
    '/emergency',
    '/healthz',
    '/css/',
    '/js/',
    '/vendor/',
    '/placeholder.jpg'
];

function getBreakGlassState(req) {
    const state = req && req.breakGlassState
        ? req.breakGlassState
        : (req && req.app && req.app.locals ? req.app.locals.breakGlass : null);
    return state && typeof state === 'object'
        ? state
        : buildBreakGlassState({ mode: BREAK_GLASS_MODES.DISABLED });
}

function isBypassPath(pathname = '') {
    return BYPASS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function isApiRequest(req) {
    if (!req) {
        return false;
    }

    const acceptHeader = typeof req.get === 'function' ? String(req.get('accept') || '') : '';
    return String(req.path || '').startsWith('/api/')
        || acceptHeader.includes('application/json')
        || acceptHeader.includes('text/event-stream')
        || req.xhr === true;
}

function buildBlockedPayload(state) {
    return {
        success: false,
        message: state.offline
            ? 'Emergency maintenance mode is active. The application is temporarily offline.'
            : 'Emergency read-only mode is active. Mutating operations are temporarily disabled.',
        breakGlass: {
            mode: state.mode,
            enabled: state.enabled,
            reason: state.reason,
            activatedAt: state.activatedAt,
            activatedBy: state.activatedBy,
            emergencyPage: '/emergency'
        }
    };
}

async function attachBreakGlassState(req, res, next) {
    try {
        const stateStore = req && req.app && req.app.locals ? req.app.locals.breakGlassStateStore : null;
        const resolvedState = stateStore && typeof stateStore.getCurrentState === 'function'
            ? await stateStore.getCurrentState()
            : getBreakGlassState(req);

        if (req) {
            req.breakGlassState = resolvedState;
        }

        if (req && req.app && req.app.locals) {
            req.app.locals.breakGlass = resolvedState;
        }

        res.locals.breakGlass = resolvedState;
        next();
    } catch (_error) {
        const fallbackState = getBreakGlassState(req);
        if (req) {
            req.breakGlassState = fallbackState;
        }
        res.locals.breakGlass = fallbackState;
        next();
    }
}

function enforceBreakGlass(req, res, next) {
    const state = getBreakGlassState(req);
    res.locals.breakGlass = state;

    if (!state.enabled || isBypassPath(req.path)) {
        return next();
    }

    if (state.offline) {
        if (isApiRequest(req)) {
            return res.status(503).json(buildBlockedPayload(state));
        }

        return res.redirect('/emergency');
    }

    if (state.mode === BREAK_GLASS_MODES.READ_ONLY && isWriteMethod(req.method)) {
        if (isApiRequest(req)) {
            return res.status(503).json(buildBlockedPayload(state));
        }

        return res.status(503).render('pages/emergency', {
            title: 'Emergency Maintenance',
            breakGlass: state,
            csrfToken: res.locals.csrfToken
        });
    }

    return next();
}

module.exports = {
    attachBreakGlassState,
    buildBlockedPayload,
    enforceBreakGlass,
    getBreakGlassState,
    isApiRequest,
    isBypassPath
};
