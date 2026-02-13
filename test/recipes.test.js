const {expect} = require('chai');

const Recipe = require('../src/models/recipes');

describe('Recipe Model', () => {
    it('Should be invalid if name is missing', () => {

        const recipe = new Recipe({
            description: 'A delicious recipe without a name.'
        });

        const error = recipe.validateSync();

        expect(error.errors.name).to.exist;
    }); 

    it('Should be invalid if prepTime is negative', () => {

        const recipe = new Recipe({
            name: 'Negative Prep Time',
            prepTime: -10
        }); 

        const error = recipe.validateSync();

        expect(error.errors.prepTime).to.exist;
    });

    it('Should be valid with required fields only', () => {
        const recipe = new Recipe({
            name: 'Simple Recipe'
        });

        const error = recipe.validateSync();

        expect(error).to.not.exist;
    });

    it('Should default isFavorite to false', () => {
        const recipe = new Recipe({
            name: 'Default Favorite'
        });

        expect(recipe.isFavorite).to.equal(false);
    });

    it('Should accept ingredients and instructions arrays', () => {
        const recipe = new Recipe({
            name: 'Array Fields',
            ingredients: ['Eggs', 'Milk'],
            instructions: ['Mix', 'Cook']
        });

        const error = recipe.validateSync();

        expect(error).to.not.exist;
        expect(recipe.ingredients).to.deep.equal(['Eggs', 'Milk']);
        expect(recipe.instructions).to.deep.equal(['Mix', 'Cook']);
    });

    it('Should allow prepTime of 0', () => {
        const recipe = new Recipe({
            name: 'Zero Prep',
            prepTime: 0
        });

        const error = recipe.validateSync();

        expect(error).to.not.exist;
    });
}); 
