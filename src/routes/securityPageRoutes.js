const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { handlePageError } = require('../utils/errorHandler');
const { buildAutomationSection } = require('../utils/automationViewModel');

router.get('/security/logs', requireAuth, (req, res) => {
    res.redirect('/security/module#logs');
});

router.get('/security/correlations', requireAuth, (req, res) => {
    res.redirect('/security/module#correlations');
});

router.get('/security/automation', requireAuth, (req, res) => {
    res.redirect('/security/module#automation');
});

router.get('/security/module', requireAuth, async (req, res) => {
    try {
        const runtimeConfig = req.app.locals.runtimeConfig || {};
        const automation = runtimeConfig.automation || {};
        const realtimeAvailable = Boolean(req.app && req.app.locals && req.app.locals.realtimeAvailable);
        const realtimeEnabled = Boolean(req.app && req.app.locals && req.app.locals.realtimeEnabled);

        res.render('pages/security-automation.ejs', {
            title: 'Security Module',
            csrfToken: res.locals.csrfToken,
            realtimeAvailable,
            realtimeEnabled,
            automation: {
                anyEnabled: Boolean((automation.logBatch && automation.logBatch.enabled)
                    || (automation.scanBatch && automation.scanBatch.enabled)
                    || (automation.intrusionBatch && automation.intrusionBatch.enabled)),
                logBatch: buildAutomationSection(automation.logBatch, {
                    source: 'server-log-batch',
                    intervalMs: 60000,
                    dedupeWindowMs: 300000,
                    maxReadBytes: 65536
                }),
                scanBatch: buildAutomationSection(automation.scanBatch, {
                    source: 'scheduled-scan-import',
                    intervalMs: 300000,
                    dedupeWindowMs: 3600000
                }),
                intrusionBatch: buildAutomationSection(automation.intrusionBatch, {
                    source: 'intrusion-runner',
                    intervalMs: 5000,
                    dedupeWindowMs: 300000
                })
            }
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load automation console');
    }
});

module.exports = router;
