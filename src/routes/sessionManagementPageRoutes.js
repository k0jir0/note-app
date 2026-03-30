const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/session-management', requireAuth, (req, res) => {
    res.redirect('/session-management/module');
});

router.get(
    '/session-management/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_session_management_module',
        resourceId: 'session-management-lab'
    }),
    (req, res) => {
        res.render('pages/session-management-module.ejs', {
            title: 'Session Security Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
