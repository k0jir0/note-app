const express = require('express');
const router = express.Router();

const missionAssuranceApiController = require('../controllers/missionAssuranceApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/mission-assurance/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_mission_assurance_module',
        resourceId: 'mission-assurance-lab'
    }),
    missionAssuranceApiController.getOverview
);

router.post(
    '/api/mission-assurance/evaluate',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'evaluate_policy_decisions',
        resourceId: 'mission-assurance-lab',
        contextResolver: (req) => ({
            networkZone: req.body && req.body.context ? req.body.context.networkZone : '',
            justification: req.body && req.body.context ? req.body.context.justification : ''
        })
    }),
    missionAssuranceApiController.evaluateDecision
);

module.exports = router;
