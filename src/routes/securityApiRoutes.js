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
// Endpoints stay mounted so runtime toggles can enable/disable them without a restart.
router.post('/api/security/realtime-ingest', requireAuthAPI, realtimeIngestRateLimiter, securityApiController.realtimeIngest);
router.get('/api/security/stream', requireAuthAPI, securityApiController.streamEvents);

module.exports = router;
