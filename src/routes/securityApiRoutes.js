const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const securityApiController = require('../controllers/securityApiController');

router.get('/api/security/alerts', requireAuthAPI, securityApiController.getAlerts);
router.post('/api/security/log-analysis', requireAuthAPI, securityApiController.analyzeLogs);

module.exports = router;
