const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

router.get('/selenium', requireAuth, (req, res) => {
    res.redirect('/selenium/module');
});

router.get('/selenium/module', requireAuth, (req, res) => {
    res.render('pages/selenium-module.ejs', {
        title: 'Selenium Module',
        csrfToken: res.locals.csrfToken
    });
});

module.exports = router;
