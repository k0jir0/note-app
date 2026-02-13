const { expect } = require("chai");

const router = require("../src/routes/recipeApiRoutes");
const recipeApiController = require("../src/controllers/recipeApiController");

const findRouteLayer = (method, path) => {
	return router.stack.find(
		(layer) =>
			layer.route &&
			layer.route.path === path &&
			layer.route.methods[method]
	);
};

describe("Recipe API Routes", () => {
	it("registers all recipe routes", () => {
		const routeLayers = router.stack.filter((layer) => layer.route);

		expect(routeLayers).to.have.length(5);
	});

	it("maps GET /api/recipes to getAllRecipes", () => {
		const layer = findRouteLayer("get", "/api/recipes");

		expect(layer).to.exist;
		expect(layer.route.stack[0].handle).to.equal(
			recipeApiController.getAllRecipes
		);
	});

	it("maps GET /api/recipes/:id to getRecipe", () => {
		const layer = findRouteLayer("get", "/api/recipes/:id");

		expect(layer).to.exist;
		expect(layer.route.stack[0].handle).to.equal(
			recipeApiController.getRecipe
		);
	});

	it("maps POST /api/recipes to createRecipe", () => {
		const layer = findRouteLayer("post", "/api/recipes");

		expect(layer).to.exist;
		expect(layer.route.stack[0].handle).to.equal(
			recipeApiController.createRecipe
		);
	});

	it("maps PUT /api/recipes/:id to updateRecipe", () => {
		const layer = findRouteLayer("put", "/api/recipes/:id");

		expect(layer).to.exist;
		expect(layer.route.stack[0].handle).to.equal(
			recipeApiController.updateRecipe
		);
	});

	it("maps DELETE /api/recipes/:id to deleteRecipe", () => {
		const layer = findRouteLayer("delete", "/api/recipes/:id");

		expect(layer).to.exist;
		expect(layer.route.stack[0].handle).to.equal(
			recipeApiController.deleteRecipe
		);
	});
});
