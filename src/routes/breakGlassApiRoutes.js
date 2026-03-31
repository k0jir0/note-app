const express = require('express');

const breakGlassApiController = require('../controllers/breakGlassApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

const router = express.Router();

router.get(
    '/api/break-glass/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_break_glass_module',
        resourceId: 'break-glass-control-center'
    }),
    breakGlassApiController.getOverview
);

module.exports = router;
