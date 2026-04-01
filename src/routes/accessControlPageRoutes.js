const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/access-control', requireAuth, (req, res) => {
    return res.redirect('/access-control/module');
});

router.get(
    '/access-control/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_access_control_module',
        resourceId: 'access-control-lab'
    }),
    (req, res) => {
        res.render('pages/access-control-module', {
            title: 'Server Access Control Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
