const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const notePageController = require('../controllers/notePageController');

router.get('/notes/new', requireAuth, notePageController.renderNoteForm);
router.get('/notes', requireAuth, notePageController.renderNotesHome);
router.get('/research', requireAuth, notePageController.renderResearchWorkspace);
router.get('/notes/:id/image', requireAuth, notePageController.renderNoteImage);
router.get('/notes/:id', requireAuth, notePageController.renderNoteDetail);
router.get('/notes/:id/edit', requireAuth, notePageController.renderEditNoteForm);
router.post('/notes', requireAuth, notePageController.createNoteFromPage);
router.post('/notes/:id', requireAuth, notePageController.updateNoteFromPage);

module.exports = router;
