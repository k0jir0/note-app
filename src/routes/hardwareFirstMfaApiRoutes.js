const express = require('express');
const router = express.Router();

const hardwareFirstMfaApiController = require('../controllers/hardwareFirstMfaApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');

router.get(
    '/api/hardware-mfa/overview',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'view_hardware_mfa_module',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.getOverview
);

router.post(
    '/api/hardware-mfa/register/options',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.issueRegistrationOptions
);

router.post(
    '/api/hardware-mfa/register/verify',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.verifyRegistration
);

router.post(
    '/api/hardware-mfa/pki/register-current',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.registerCurrentPkiCertificate
);

router.post(
    '/api/hardware-mfa/challenge',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.issueChallenge
);

router.post(
    '/api/hardware-mfa/verify',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.verifyChallenge
);

router.post(
    '/api/hardware-mfa/revoke',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'perform_hardware_mfa_step_up',
        resourceId: 'hardware-mfa-lab'
    }),
    hardwareFirstMfaApiController.revokeSession
);

module.exports = router;
