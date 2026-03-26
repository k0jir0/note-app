const express = require('express');
const router = express.Router();

const injectionPreventionApiController = require('../controllers/injectionPreventionApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/injection-prevention/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_injection_prevention_module',
        resourceId: 'injection-prevention-lab'
    }),
    injectionPreventionApiController.getOverview
);

router.post(
    '/api/injection-prevention/evaluate',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'evaluate_injection_prevention_controls',
        resourceId: 'injection-prevention-lab'
    }),
    injectionPreventionApiController.evaluateScenario
);

module.exports = router;
