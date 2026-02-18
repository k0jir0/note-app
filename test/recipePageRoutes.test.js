const { expect } = require("chai");
const sinon = require("sinon");

const router = require("../src/routes/recipePageRoutes");

const getHandler = (method, path) => {
	const layer = router.stack.find(
		(entry) =>
			entry.route &&
			entry.route.path === path &&
			entry.route.methods[method]
	);

	return layer ? layer.route.stack[0].handle : null;
};

const buildRes = () => ({
	render: sinon.stub(),
});

describe("Recipe Page Routes", () => {
	afterEach(() => {
		sinon.restore();
	});

	it("maps GET / to a handler", () => {
		const handler = getHandler("get", "/");

		expect(handler).to.exist;
	});

	it("maps GET /recipes/new to a handler", () => {
		const handler = getHandler("get", "/recipes/new");

		expect(handler).to.exist;
	});

	it("maps GET /recipes to a handler", () => {
		const handler = getHandler("get", "/recipes");

		expect(handler).to.exist;
	});

	it("maps GET /recipes/:id to a handler", () => {
		const handler = getHandler("get", "/recipes/:id");

		expect(handler).to.exist;
	});

	it("maps GET /recipes/:id/edit to a handler", () => {
		const handler = getHandler("get", "/recipes/:id/edit");

		expect(handler).to.exist;
	});

	it("renders the home page for GET /", async () => {
		const handler = getHandler("get", "/");
		const fakeRecipes = [{ name: "Pasta" }];

		sinon.stub(global, "fetch").resolves({
			json: sinon.stub().resolves(fakeRecipes),
		});

		const req = {};
		const res = buildRes();

		await handler(req, res);

		expect(global.fetch.calledWith("http://localhost:3000/api/recipes")).to
			.be.true;
		expect(
			res.render.calledWith("pages/home.ejs", {
				title: "Recipe App",
				recipes: fakeRecipes,
			})
		).to.be.true;
	});

	it("renders the recipe form for GET /recipes/new", async () => {
		const handler = getHandler("get", "/recipes/new");

		const req = {};
		const res = buildRes();

		await handler(req, res);

		expect(
			res.render.calledWith("pages/recipe-form.ejs", { recipe: null })
		).to.be.true;
	});

	it("renders the home page for GET /recipes", async () => {
		const handler = getHandler("get", "/recipes");
		const fakeRecipes = [{ name: "Tacos" }];

		sinon.stub(global, "fetch").resolves({
			json: sinon.stub().resolves(fakeRecipes),
		});

		const req = {};
		const res = buildRes();

		await handler(req, res);

		expect(global.fetch.calledWith("http://localhost:3000/api/recipes")).to
			.be.true;
		expect(
			res.render.calledWith("pages/home.ejs", {
				title: "Recipe App",
				recipes: fakeRecipes,
			})
		).to.be.true;
	});

	it("renders a single recipe for GET /recipes/:id", async () => {
		const handler = getHandler("get", "/recipes/:id");
		const fakeRecipe = { name: "Soup" };

		sinon.stub(global, "fetch").resolves({
			json: sinon.stub().resolves(fakeRecipe),
		});

		const req = { params: { id: "abc123" } };
		const res = buildRes();

		await handler(req, res);

		expect(
			global.fetch.calledWith(
				"http://localhost:3000/api/recipes/abc123"
			)
		).to.be.true;
		expect(
			res.render.calledWith("pages/recipe.ejs", { recipe: fakeRecipe })
		).to.be.true;
	});

	it("renders the edit form for GET /recipes/:id/edit", async () => {
		const handler = getHandler("get", "/recipes/:id/edit");
		const fakeRecipe = { name: "Salad" };

		sinon.stub(global, "fetch").resolves({
			json: sinon.stub().resolves(fakeRecipe),
		});

		const req = { params: { id: "xyz789" } };
		const res = buildRes();

		await handler(req, res);

		expect(
			global.fetch.calledWith(
				"http://localhost:3000/api/recipes/xyz789"
			)
		).to.be.true;
		expect(
			res.render.calledWith("pages/recipe-form.ejs", { recipe: fakeRecipe })
		).to.be.true;
	});
});
