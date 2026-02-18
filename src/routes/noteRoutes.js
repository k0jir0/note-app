const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { requireAuth } = require('../middleware/auth');

// Legacy routes - kept for backward compatibility
// Protected with authentication
router.get('/', requireAuth, noteController.getAllNotes);

router.get('/note/:id', requireAuth, noteController.getNote);

module.exports = router;

