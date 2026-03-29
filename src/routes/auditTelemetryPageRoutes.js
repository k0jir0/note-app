const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { handlePageError } = require('../utils/errorHandler');
const { buildAuditTelemetryModuleViewModel } = require('../services/march29ResearchModuleService');

router.get('/audit-telemetry', requireAuth, (req, res) => {
    res.redirect('/audit-telemetry/module');
});

router.get('/audit-telemetry/module', requireAuth, (req, res) => {
    try {
        res.render('pages/audit-telemetry-module.ejs', {
            title: 'Audit and Telemetry Module',
            csrfToken: res.locals.csrfToken,
            moduleData: buildAuditTelemetryModuleViewModel({
                appLocals: req.app && req.app.locals ? req.app.locals : {}
            })
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load the audit and telemetry module');
    }
});

module.exports = router;