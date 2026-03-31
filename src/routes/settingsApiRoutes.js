const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const {
    requirePrivilegedRuntimeMutationAccess,
    requirePrivilegedRuntimeReadAccess,
    requireRecentPrivilegedStepUp
} = require('../middleware/privilegedRuntime');
const settingsApiController = require('../controllers/settingsApiController');

router.post('/api/settings/theme', requireAuthAPI, settingsApiController.updateThemePreference);
router.get('/api/settings/accounts', requireAuthAPI, requirePrivilegedRuntimeReadAccess(), settingsApiController.listManagedAccounts);
router.post('/api/settings/accounts', requireAuthAPI, requirePrivilegedRuntimeMutationAccess(), requireRecentPrivilegedStepUp(), settingsApiController.provisionManagedAccount);
router.patch('/api/settings/accounts/:userId/state', requireAuthAPI, requirePrivilegedRuntimeMutationAccess(), requireRecentPrivilegedStepUp(), settingsApiController.updateManagedAccountState);

module.exports = router;
