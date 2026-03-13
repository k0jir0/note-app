const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const { securityAnalysisRateLimiter } = require('../middleware/rateLimit');
const securityApiController = require('../controllers/securityApiController');

router.get('/api/security/alerts', requireAuthAPI, securityApiController.getAlerts);
router.get('/api/security/correlations', requireAuthAPI, securityApiController.getCorrelations);
router.post('/api/security/correlations/sample', requireAuthAPI, securityAnalysisRateLimiter, securityApiController.getSampleCorrelations);
router.post('/api/security/log-analysis', requireAuthAPI, securityAnalysisRateLimiter, securityApiController.analyzeLogs);

module.exports = router;
