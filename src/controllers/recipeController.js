const Recipes = require('../models/recipes');

exports.getAllRecipes = async (req, res) => {
    try {
        const recipes = await Recipes.find({});
        res.render('pages/home', { title: 'Recipe Picker App', recipes: recipes });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getRecipe = async (req, res) => {
    try {
        const recipe = await Recipes.findById(req.params.id);
        if (!recipe) {
            return res.status(404).send('Recipe not found');
        }

        res.render('pages/recipe', { recipe });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};