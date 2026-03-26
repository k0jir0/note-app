const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

router.get('/hardware-mfa', requireAuth, (req, res) => {
    res.redirect('/hardware-mfa/module');
});

router.get('/hardware-mfa/module', requireAuth, (req, res) => {
    res.render('pages/hardware-mfa-module.ejs', {
        title: 'Hardware-First MFA Module',
        csrfToken: res.locals.csrfToken
    });
});

module.exports = router;
