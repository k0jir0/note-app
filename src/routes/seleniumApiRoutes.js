const express = require('express');
const router = express.Router();

const seleniumApiController = require('../controllers/seleniumApiController');
const { requireAuthAPI } = require('../middleware/auth');

router.get('/api/selenium/overview', requireAuthAPI, seleniumApiController.getOverview);
router.get('/api/selenium/script', requireAuthAPI, seleniumApiController.getScript);

module.exports = router;
