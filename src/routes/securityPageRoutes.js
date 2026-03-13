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

module.exports = router;
