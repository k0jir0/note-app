const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

router.get('/playwright', requireAuth, (req, res) => {
    res.redirect('/playwright/module');
});

router.get('/playwright/module', requireAuth, (req, res) => {
    res.render('pages/playwright-module.ejs', {
        title: 'Playwright Module',
        csrfToken: res.locals.csrfToken
    });
});

module.exports = router;
