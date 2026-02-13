const {expect} = require("chai");
//expect(true).to.be.true;

const sinon = require("sinon");

const recipeApiController = require("../src/controllers/recipeApiController");
const Recipes = require("../src/models/recipes");

describe("Recipe API Controller - getAllRecipes", () => {

    afterEach(() => {
        sinon.restore();
    });

    it("should return all recipes with status 200", async () => {
        const fakeRecipes = [
            { name: 'Spaghetti Bolognese',
                description: 'Classic Italian meat sauce.',
            },
            { name: 'Chicken Curry',
                description: 'Spicy and flavorful Indian dish.',
            }
        ];

        sinon.stub(Recipes, "find").resolves(fakeRecipes);

        const req = {};
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
        };

        await recipeApiController.getAllRecipes(req, res);

        //console.log(res);

        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledWith(fakeRecipes)).to.be.true;
    }); 

    it("should return 500 if there is a server error", async () => {
        sinon.stub(Recipes, "find").throws(new Error("Database error"));
        
        const req = {};

        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(), 
        };

        await recipeApiController.getAllRecipes(req, res);

        expect(res.status.calledWith(500)).to.be.true;
        expect(res.json.calledWith({ message: 'Server Error' })).to.be.true;
    });
});

describe("Recipe API Controller - createRecipe", () => {
    afterEach(() => {
        sinon.restore();
    });

    it("should create a new recipe and return it with status 201", async () => {
        const fakeRecipe = {
            name: 'Pancakes',
            description: 'Fluffy pancakes with syrup.',
        }
        
        sinon.stub(Recipes, "create").resolves(fakeRecipe);

        const req = {
            body: fakeRecipe
        }

        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
        }

        await recipeApiController.createRecipe(req, res);

        expect(res.status.calledWith(201)).to.be.true;
        expect(res.json.calledWith((fakeRecipe))).to.be.true;
    });     
}); 