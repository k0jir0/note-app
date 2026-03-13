const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const SecurityAlert = require('../models/SecurityAlert');
const { handlePageError } = require('../utils/errorHandler');

router.get('/security/logs', requireAuth, async (req, res) => {
    try {
        const alerts = await SecurityAlert.find({ user: req.user._id })
            .sort({ detectedAt: -1, createdAt: -1 })
            .limit(20);

        res.render('pages/security-logs.ejs', {
            title: 'Log Analysis Assistant',
            alerts
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load security dashboard');
    }
});

router.get('/security/correlations', requireAuth, async (req, res) => {
    try {
        res.render('pages/security-correlations.ejs', {
            title: 'Correlation Dashboard',
            correlations: [],
            overview: {
                total: 0,
                highPriority: 0,
                targets: 0
            }
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load correlation dashboard');
    }
});

module.exports = router;
