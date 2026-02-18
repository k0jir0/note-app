const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, noteController.getAllNotes);

router.get('/note/:id', requireAuth, noteController.getNote);

module.exports = router;

