const express = require('express');
const router = express.Router();

const playwrightApiController = require('../controllers/playwrightApiController');
const { requireAuthAPI } = require('../middleware/auth');

router.get('/api/playwright/overview', requireAuthAPI, playwrightApiController.getOverview);
router.get('/api/playwright/script', requireAuthAPI, playwrightApiController.getScript);

module.exports = router;
