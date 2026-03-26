const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

router.get('/mission-assurance', requireAuth, (req, res) => {
    res.redirect('/mission-assurance/module');
});

router.get('/mission-assurance/module', requireAuth, (req, res) => {
    res.render('pages/mission-assurance-module.ejs', {
        title: 'Mission Assurance Module',
        csrfToken: res.locals.csrfToken
    });
});

module.exports = router;
