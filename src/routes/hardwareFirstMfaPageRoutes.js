const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/hardware-mfa', requireAuth, (req, res) => {
    res.redirect('/hardware-mfa/module');
});

router.get(
    '/hardware-mfa/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_hardware_mfa_module',
        resourceId: 'hardware-mfa-lab'
    }),
    (req, res) => {
        res.render('pages/hardware-mfa-module.ejs', {
            title: 'Hardware-Backed MFA Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
