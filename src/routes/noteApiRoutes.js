const express = require('express');
const router = express.Router();
const noteApiController = require('../controllers/noteApiController');
const { requireAuthAPI } = require('../middleware/auth');

router.get('/api/notes', requireAuthAPI, noteApiController.getAllNotes);
router.get('/api/notes/:id', requireAuthAPI, noteApiController.getNote);
router.post('/api/notes', requireAuthAPI, noteApiController.createNote);
router.put('/api/notes/:id', requireAuthAPI, noteApiController.updateNote);
router.delete('/api/notes/:id', requireAuthAPI, noteApiController.deleteNote);

module.exports = router;
