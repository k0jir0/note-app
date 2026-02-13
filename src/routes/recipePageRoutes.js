const express = require('express');
const router = express.Router();

//const recipeApiController = require('../controllers/recipeApiController');

router.get('/', async (req, res) => {
    const response = await fetch('http://localhost:3000/api/recipes');
    const recipes = await response.json();
    res.render('pages/home.ejs', { title: "Recipe App", recipes });
});

router.get('/recipes/new', (req, res) => {
    res.render('pages/recipe-form.ejs', {recipe  : null});   

})

router.get('/recipes', async (req, res) => {
    const response = await fetch('http://localhost:3000/api/recipes');
    const recipes = await response.json();
    res.render('pages/home.ejs', { title: "Recipe App", recipes });
});

router.get('/recipes/:id', async (req, res) => {
    const response = await fetch(`http://localhost:3000/api/recipes/${req.params.id}`);
    const recipe = await response.json();
    res.render('pages/recipe.ejs', {recipe});
});

router.get('/recipes/:id/edit', async (req, res) => {
    const response = await fetch(`http://localhost:3000/api/recipes/${req.params.id}`);
    const recipe = await response.json();
    res.render('pages/recipe-form.ejs', {recipe});
});


module.exports = router;