const express = require('express');
const { requireAuthAPI } = require('../middleware/auth');
const { toDiagnosticRuntimeConfig } = require('../config/runtimeConfig');
const {
    requirePrivilegedDevToolsEnabled,
    requirePrivilegedRuntimeMutationAccess,
    requirePrivilegedRuntimeReadAccess,
    requireRecentPrivilegedStepUp
} = require('../middleware/privilegedRuntime');

const router = express.Router();

function parseEnabledFlag(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }

    return null;
}

router.get('/__runtime-config', requireAuthAPI, requirePrivilegedDevToolsEnabled(), requirePrivilegedRuntimeReadAccess(), (req, res) => {
    try {
        return res.status(200).json({
            runtimeConfig: toDiagnosticRuntimeConfig(req.app && req.app.locals ? req.app.locals.runtimeConfig || null : null)
        });
    } catch (_error) {
        return res.status(500).json({ error: 'unable to read runtime config' });
    }
});

router.get('/__realtime-status', requireAuthAPI, requirePrivilegedDevToolsEnabled(), requirePrivilegedRuntimeReadAccess(), (req, res) => {
    try {
        return res.status(200).json({
            enableEnv: String(process.env.ENABLE_REALTIME || ''),
            realtimeAvailable: Boolean(req.app && req.app.locals && req.app.locals.realtimeAvailable),
            realtimeEnabled: Boolean(req.app && req.app.locals && req.app.locals.realtimeEnabled),
            sseMounted: true
        });
    } catch (_error) {
        return res.status(500).json({ error: 'unable to determine realtime status' });
    }
});

router.post(
    '/api/runtime/realtime',
    requireAuthAPI,
    requirePrivilegedDevToolsEnabled(),
    requirePrivilegedRuntimeMutationAccess(),
    requireRecentPrivilegedStepUp(),
    (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                message: 'Runtime toggles are disabled in production'
            });
        }

        if (!req.app || !req.app.locals || !req.app.locals.realtimeAvailable) {
            return res.status(503).json({
                success: false,
                message: 'Realtime requires REDIS_URL to be configured'
            });
        }

        const bodyEnabled = typeof req.body?.enabled !== 'undefined'
            ? parseEnabledFlag(req.body.enabled)
            : null;

        if (bodyEnabled === null) {
            return res.status(400).json({
                success: false,
                message: 'enabled must be a boolean or the string true/false'
            });
        }

        req.app.locals.realtimeEnabled = bodyEnabled;
        return res.status(200).json({
            success: true,
            realtimeEnabled: req.app.locals.realtimeEnabled
        });
    } catch (_error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to toggle realtime'
        });
    }
});

module.exports = router;
