const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    ingredients: [String],
    instructions: [String],
    prepTime: Number,
    cookTime: Number,
    image: String,
    isFavorite: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Recipe', recipeSchema);