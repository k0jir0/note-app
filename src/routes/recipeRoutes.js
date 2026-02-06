const express = require('express');
const recipes = require('../models/recipes');

const router = express.Router();

const recipeController = require('../controllers/recipeController');

router.get('/', (req, res) => {
    recipeController.getAllRecipes(req, res);
});

router.get('/recipe/:id', (req, res) => {
    recipeController.getRecipe(req, res);
});





router.get('/', (req, res) => {
    res.json(recipes);
})

module.exports = router;

