const express = require('express');
const router = express.Router();
const noteApiController = require('../controllers/noteApiController');
const { requireAuthAPI } = require('../middleware/auth');
const { validateCreateNote, validateUpdateNote } = require('../middleware/requestValidator');

router.get('/api/notes', requireAuthAPI, noteApiController.getAllNotes);
router.get('/api/notes/:id', requireAuthAPI, noteApiController.getNote);
router.post('/api/notes', requireAuthAPI, validateCreateNote, noteApiController.createNote);
router.put('/api/notes/:id', requireAuthAPI, validateUpdateNote, noteApiController.updateNote);
router.delete('/api/notes/:id', requireAuthAPI, noteApiController.deleteNote);

module.exports = router;
