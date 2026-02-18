const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { requireAuth } = require('../middleware/auth');

// Legacy routes - kept for backward compatibility
// Protected with authentication
router.get('/', requireAuth, (req, res) => {
    noteController.getAllNotes(req, res);
});

router.get('/note/:id', requireAuth, (req, res) => {
    noteController.getNote(req, res);
});

module.exports = router;

