const express = require('express');
const router = express.Router();

const sessionManagementApiController = require('../controllers/sessionManagementApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/session-management/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_session_management_module',
        resourceId: 'session-management-lab'
    }),
    sessionManagementApiController.getOverview
);

router.post(
    '/api/session-management/evaluate',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'evaluate_session_lockdown_controls',
        resourceId: 'session-management-lab'
    }),
    sessionManagementApiController.evaluateScenario
);

module.exports = router;
