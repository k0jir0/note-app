const express = require('express');
const router = express.Router();

const mlApiController = require('../controllers/mlApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { requireMissionAccessAPI } = require('../middleware/missionAccess');
const { securityAnalysisRateLimiter } = require('../middleware/rateLimit');

router.get('/api/ml/overview', requireAuthAPI, mlApiController.getOverview);
router.post(
    '/api/ml/train',
    requireAuthAPI,
    requireMissionAccessAPI({
        actionId: 'train_ml_model',
        resourceId: 'triage-model-training'
    }),
    securityAnalysisRateLimiter,
    mlApiController.trainModel
);
router.post('/api/ml/autonomy-demo', requireAuthAPI, securityAnalysisRateLimiter, mlApiController.injectAutonomyDemo);

module.exports = router;
