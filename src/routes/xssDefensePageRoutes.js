const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/xss-defense', (req, res) => {
    return res.redirect('/xss-defense/module');
});

router.get(
    '/xss-defense/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_xss_defense_module',
        resourceId: 'xss-defense-lab'
    }),
    (req, res) => {
        res.render('pages/xss-defense-module', {
            title: 'XSS Defense Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
