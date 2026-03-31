const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const settingsApiController = require('../controllers/settingsApiController');

router.post('/api/settings/theme', requireAuthAPI, settingsApiController.updateThemePreference);

module.exports = router;
