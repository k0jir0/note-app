const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/security/scans', requireAuth, (req, res) => {
    res.redirect('/security/module#scans');
});

module.exports = router;
