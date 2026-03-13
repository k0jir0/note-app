const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ScanResult = require('../models/ScanResult');
const { handlePageError } = require('../utils/errorHandler');

router.get('/security/scans', requireAuth, async (req, res) => {
    try {
        const scans = await ScanResult.find({ user: req.user._id })
            .sort({ importedAt: -1, createdAt: -1 })
            .limit(20);

        res.render('pages/security-scans.ejs', {
            title: 'Vulnerability Scan Importer',
            scans,
            csrfToken: res.locals.csrfToken
        });
    } catch (error) {
        handlePageError(res, error, 'Unable to load scan dashboard');
    }
});

module.exports = router;
