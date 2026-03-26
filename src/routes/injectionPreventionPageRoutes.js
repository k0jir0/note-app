const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

router.get('/injection-prevention', (req, res) => {
    return res.redirect('/injection-prevention/module');
});

router.get(
    '/injection-prevention/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_injection_prevention_module',
        resourceId: 'injection-prevention-lab'
    }),
    (req, res) => {
        res.render('pages/injection-prevention-module', {
            title: 'Injection Prevention Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;
