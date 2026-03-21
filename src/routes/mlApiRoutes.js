const express = require('express');
const router = express.Router();

const mlApiController = require('../controllers/mlApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { securityAnalysisRateLimiter } = require('../middleware/rateLimit');

router.get('/api/ml/overview', requireAuthAPI, mlApiController.getOverview);
router.post('/api/ml/train', requireAuthAPI, securityAnalysisRateLimiter, mlApiController.trainModel);

module.exports = router;
