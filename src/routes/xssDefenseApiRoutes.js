const express = require('express');
const router = express.Router();

const xssDefenseApiController = require('../controllers/xssDefenseApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/xss-defense/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_xss_defense_module',
        resourceId: 'xss-defense-lab'
    }),
    xssDefenseApiController.getOverview
);

router.post(
    '/api/xss-defense/evaluate',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'evaluate_xss_defense_controls',
        resourceId: 'xss-defense-lab'
    }),
    xssDefenseApiController.evaluateScenario
);

module.exports = router;
