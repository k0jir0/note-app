const express = require('express');
const router = express.Router();
const { requireAuthAPI } = require('../middleware/auth');
const scanApiController = require('../controllers/scanApiController');

router.get('/api/security/scans', requireAuthAPI, scanApiController.getScans);
router.post('/api/security/scan-import', requireAuthAPI, scanApiController.importScan);

module.exports = router;
