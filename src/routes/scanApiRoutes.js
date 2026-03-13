const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const { securityAnalysisRateLimiter } = require('../middleware/rateLimit');
const scanApiController = require('../controllers/scanApiController');

router.get('/api/security/scans', requireAuthAPI, scanApiController.getScans);
router.post('/api/security/scan-import', requireAuthAPI, securityAnalysisRateLimiter, scanApiController.importScan);

module.exports = router;
