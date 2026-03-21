const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

router.get('/ml', requireAuth, (req, res) => {
    res.redirect('/ml/module');
});

router.get('/ml/module', requireAuth, (req, res) => {
    res.render('pages/ml-module.ejs', {
        title: 'ML Module',
        csrfToken: res.locals.csrfToken
    });
});

module.exports = router;
