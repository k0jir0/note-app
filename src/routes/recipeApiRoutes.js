const express = require('express');
const router = express.Router();
const recipeApiController = require('../controllers/recipeApiController');

router.get('/api/recipes', recipeApiController.getAllRecipes);
router.get('/api/recipes/:id', recipeApiController.getRecipe);
router.post('/api/recipes', recipeApiController.createRecipe);
router.put('/api/recipes/:id', recipeApiController.updateRecipe);
router.delete('/api/recipes/:id', recipeApiController.deleteRecipe);

module.exports = router;
