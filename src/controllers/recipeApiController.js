const Recipes = require('../models/recipes');

// CREATE Operations
exports.createRecipe = async (req, res) => {
    try {
        console.log(req.body);
        const recipe = await Recipes.create(req.body);
        res.status(201).json(recipe);
    } catch (error) {
        console.error('Create recipe failed:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }   
};  

// READ Operations
exports.getAllRecipes = async (req, res) => {
    try {
        const recipes = await Recipes.find({});
        res.status(200).json(recipes);
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

        res.json(recipe);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// U - Update
exports.updateRecipe = async (req, res) => {
    try {
        const recipe = await Recipes.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

    if (!recipe) {
        return res.status(404).send({ error: 'Recipe not found'});    
    }
    res.json(recipe);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }        
};

// D - Delete
exports.deleteRecipe = async (req, res) => {
    try {
        const recipe = await Recipes.findByIdAndDelete(req.params.id);
        if (!recipe) {
            return res.status(404).send({ error: 'Recipe not found' });
        }   

        res.status(204).json({ message: 'Recipe deleted successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
}