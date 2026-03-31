const express = require('express');

const { requireAuthAPI } = require('../middleware/auth');
const {
    BREAK_GLASS_MODES,
    buildBreakGlassState,
    canControlBreakGlass,
    normalizeBreakGlassMode,
    updateBreakGlassState
} = require('../services/breakGlassService');

const router = express.Router();

function requireBreakGlassControl(req, res, next) {
    if (canControlBreakGlass(req.user)) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Break-glass controls require an admin or break_glass role'
    });
}

router.get('/emergency', (req, res) => {
    const breakGlass = req.app && req.app.locals && req.app.locals.breakGlass
        ? req.app.locals.breakGlass
        : buildBreakGlassState({ mode: BREAK_GLASS_MODES.DISABLED });

    if (!breakGlass.enabled) {
        return res.redirect('/');
    }

    return res.status(503).render('pages/emergency', {
        title: 'Emergency Maintenance',
        breakGlass,
        csrfToken: res.locals ? res.locals.csrfToken : undefined
    });
});

router.get('/api/runtime/break-glass', requireAuthAPI, requireBreakGlassControl, (req, res) => {
    const breakGlass = req.app && req.app.locals && req.app.locals.breakGlass
        ? req.app.locals.breakGlass
        : buildBreakGlassState({ mode: BREAK_GLASS_MODES.DISABLED });

    return res.status(200).json({
        success: true,
        breakGlass
    });
});

router.post('/api/runtime/break-glass', requireAuthAPI, requireBreakGlassControl, (req, res) => {
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

    const updatedState = updateBreakGlassState(req.app.locals.breakGlass, {
        mode: normalizedMode,
        reason,
        activatedBy: req.user && (req.user.email || req.user.name) ? (req.user.email || req.user.name) : 'authorized-operator',
        activatedAt: new Date().toISOString()
    });

    req.app.locals.breakGlass = updatedState;

    return res.status(200).json({
        success: true,
        breakGlass: updatedState
    });
});

module.exports = router;
