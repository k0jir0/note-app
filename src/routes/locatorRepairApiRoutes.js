const express = require('express');
const router = express.Router();

const locatorRepairApiController = require('../controllers/locatorRepairApiController');
const { requireAuthAPI } = require('../middleware/auth');

router.get('/api/locator-repair/overview', requireAuthAPI, locatorRepairApiController.getOverview);
router.get('/api/locator-repair/history', requireAuthAPI, locatorRepairApiController.getHistory);
router.post('/api/locator-repair/suggest', requireAuthAPI, locatorRepairApiController.suggestRepairs);
router.post('/api/locator-repair/feedback', requireAuthAPI, locatorRepairApiController.recordFeedback);
router.post('/api/locator-repair/train', requireAuthAPI, locatorRepairApiController.trainModel);

module.exports = router;
