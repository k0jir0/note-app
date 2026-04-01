const express = require('express');
const router = express.Router();

const accessControlApiController = require('../controllers/accessControlApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/access-control/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_access_control_module',
        resourceId: 'access-control-lab'
    }),
    accessControlApiController.getOverview
);
router.post(
    '/api/access-control/evaluate',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'evaluate_access_control_controls',
        resourceId: 'access-control-lab'
    }),
    accessControlApiController.evaluateScenario
);

module.exports = router;
