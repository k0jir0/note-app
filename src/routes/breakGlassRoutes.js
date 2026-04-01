const express = require('express');

const { requireAuthAPI } = require('../middleware/auth');
const {
    requireBreakGlassRuntimeAccess,
    requireRecentPrivilegedStepUp
} = require('../middleware/privilegedRuntime');
const {
    BREAK_GLASS_MODES,
    buildBreakGlassState,
    normalizeBreakGlassMode,
    updateBreakGlassState
} = require('../services/breakGlassService');

const router = express.Router();

async function resolveBreakGlassState(req) {
    const stateStore = req && req.app && req.app.locals ? req.app.locals.breakGlassStateStore : null;

    if (stateStore && typeof stateStore.getCurrentState === 'function') {
        const state = await stateStore.getCurrentState({ refresh: true });
        req.breakGlassState = state;

        if (req.app && req.app.locals) {
            req.app.locals.breakGlass = state;
        }

        return state;
    }

    const state = req && req.app && req.app.locals && req.app.locals.breakGlass
        ? req.app.locals.breakGlass
        : buildBreakGlassState({ mode: BREAK_GLASS_MODES.DISABLED });

    req.breakGlassState = state;
    return state;
}

async function persistBreakGlassState(req, nextState) {
    const stateStore = req && req.app && req.app.locals ? req.app.locals.breakGlassStateStore : null;
    const updatedState = stateStore && typeof stateStore.updateState === 'function'
        ? await stateStore.updateState(nextState)
        : nextState;

    req.breakGlassState = updatedState;

    if (req && req.app && req.app.locals) {
        req.app.locals.breakGlass = updatedState;
    }

    return updatedState;
}

router.get('/emergency', async (req, res) => {
    let breakGlass;

    try {
        breakGlass = await resolveBreakGlassState(req);
    } catch (_error) {
        breakGlass = buildBreakGlassState({ mode: BREAK_GLASS_MODES.OFFLINE });
    }

    if (!breakGlass.enabled) {
        return res.redirect('/');
    }

    return res.status(503).render('pages/emergency', {
        title: 'Emergency Maintenance',
        breakGlass,
        csrfToken: res.locals ? res.locals.csrfToken : undefined
    });
});

router.get('/api/runtime/break-glass', requireAuthAPI, requireBreakGlassRuntimeAccess(), async (req, res) => {
    try {
        const breakGlass = await resolveBreakGlassState(req);

        return res.status(200).json({
            success: true,
            breakGlass
        });
    } catch (_error) {
        return res.status(503).json({
            success: false,
            message: 'Break-glass runtime state is temporarily unavailable.'
        });
    }
});

router.post(
    '/api/runtime/break-glass',
    requireAuthAPI,
    requireBreakGlassRuntimeAccess(),
    requireRecentPrivilegedStepUp(),
    async (req, res) => {
        try {
            const normalizedMode = normalizeBreakGlassMode(req.body && req.body.mode);
            if (!normalizedMode) {
                return res.status(400).json({
                    success: false,
                    message: 'mode must be one of disabled, read_only, or offline'
                });
            }

            const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
            if (normalizedMode !== BREAK_GLASS_MODES.DISABLED && !reason) {
                return res.status(400).json({
                    success: false,
                    message: 'reason is required when break-glass mode is enabled'
                });
            }

            const currentState = await resolveBreakGlassState(req);
            const updatedState = updateBreakGlassState(currentState, {
                mode: normalizedMode,
                reason,
                activatedBy: req.user && (req.user.email || req.user.name) ? (req.user.email || req.user.name) : 'authorized-operator',
                activatedAt: new Date().toISOString()
            });
            const persistedState = await persistBreakGlassState(req, updatedState);

            return res.status(200).json({
                success: true,
                breakGlass: persistedState
            });
        } catch (_error) {
            return res.status(503).json({
                success: false,
                message: 'Break-glass runtime state could not be persisted.'
            });
        }
    }
);

module.exports = router;
