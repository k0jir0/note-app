const { expect } = require("chai");
const sinon = require("sinon");

const router = require("../src/routes/recipeRoutes");
const recipeController = require("../src/controllers/recipeController");
const recipes = require("../src/models/recipes");

const getLayers = (method, path) => {
	return router.stack.filter(
		(layer) =>
			layer.route &&
			layer.route.path === path &&
			layer.route.methods[method]
	);
};

describe("Recipe Routes", () => {
	afterEach(() => {
		sinon.restore();
	});

	it("registers routes", () => {
		const routeLayers = router.stack.filter((layer) => layer.route);

		expect(routeLayers).to.have.length(3);
	});

	it("GET / calls recipeController.getAllRecipes", () => {
		const layers = getLayers("get", "/");

		expect(layers).to.have.length(2);

		const handler = layers[0].route.stack[0].handle;
		const req = {};
		const res = {};

		const stub = sinon.stub(recipeController, "getAllRecipes");

		handler(req, res);

		expect(stub.calledOnceWith(req, res)).to.be.true;
	});

	it("GET / returns the recipes model", () => {
		const layers = getLayers("get", "/");

		expect(layers).to.have.length(2);

		const handler = layers[1].route.stack[0].handle;
		const req = {};
		const res = { json: sinon.stub() };

		handler(req, res);

		expect(res.json.calledOnceWith(recipes)).to.be.true;
	});

	it("GET /recipe/:id calls recipeController.getRecipe", () => {
		const layers = getLayers("get", "/recipe/:id");

		expect(layers).to.have.length(1);

		const handler = layers[0].route.stack[0].handle;
		const req = { params: { id: "abc123" } };
		const res = {};

		const stub = sinon.stub(recipeController, "getRecipe");

		handler(req, res);

		expect(stub.calledOnceWith(req, res)).to.be.true;
	});
});
