const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireMissionAccessPage } = require('../middleware/missionAccess');

const router = express.Router();

router.get('/break-glass', requireAuth, (req, res) => {
    return res.redirect('/break-glass/module');
});

router.get(
    '/break-glass/module',
    requireAuth,
    requireMissionAccessPage({
        actionId: 'view_break_glass_module',
        resourceId: 'break-glass-control-center'
    }),
    (req, res) => {
        return res.render('pages/break-glass-module', {
            title: 'Break-Glass and Emergency Control Module',
            csrfToken: res.locals.csrfToken
        });
    }
);

module.exports = router;