const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const { securityAnalysisRateLimiter, realtimeIngestRateLimiter } = require('../middleware/rateLimit');
const securityApiController = require('../controllers/securityApiController');

router.get('/api/security/alerts', requireAuthAPI, securityApiController.getAlerts);
router.get('/api/security/correlations', requireAuthAPI, securityApiController.getCorrelations);
router.post('/api/security/automation/sample', requireAuthAPI, securityAnalysisRateLimiter, securityApiController.injectAutomationSample);
router.post('/api/security/correlations/sample', requireAuthAPI, securityAnalysisRateLimiter, securityApiController.getSampleCorrelations);
router.post('/api/security/log-analysis', requireAuthAPI, securityAnalysisRateLimiter, securityApiController.analyzeLogs);

// Real-time ingestion and event stream
// Real-time endpoints are optional and can be enabled with ENABLE_REALTIME=1
// Always mount realtime endpoints; runtime gating happens in the handlers
// Only mount realtime endpoints when explicitly enabled via environment
if (process.env.ENABLE_REALTIME === '1') {
	router.post('/api/security/realtime-ingest', requireAuthAPI, realtimeIngestRateLimiter, securityApiController.realtimeIngest);
	router.get('/api/security/stream', requireAuthAPI, securityApiController.streamEvents);
}

module.exports = router;
