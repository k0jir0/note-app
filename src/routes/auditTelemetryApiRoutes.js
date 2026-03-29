const express = require('express');
const router = express.Router();

const { requireAuthAPI } = require('../middleware/auth');
const auditTelemetryApiController = require('../controllers/auditTelemetryApiController');

router.get('/api/audit-telemetry/events', requireAuthAPI, auditTelemetryApiController.getEvents);

module.exports = router;