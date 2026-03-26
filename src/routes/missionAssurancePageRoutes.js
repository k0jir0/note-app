const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/mission-assurance', requireAuth, (req, res) => {
    res.redirect('/mission-assurance/module');
});

router.get(
    '/mission-assurance/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_mission_assurance_module',
        resourceId: 'mission-assurance-lab'
    }),
    (req, res) => {
        res.render('pages/mission-assurance-module.ejs', {
            title: 'Mission Assurance Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
